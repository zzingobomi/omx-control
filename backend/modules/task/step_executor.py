import logging
import threading
import time
from typing import TYPE_CHECKING
import cv2
import numpy as np

from core.common import GRIPPER_SETTLE
from core.types import TrajStatus
from core.topic_map import Service, Topic
from modules.calibration.loader import CalibrationData
from .step_types import (
    DetectStep,
    GripperStep,
    HomeStep,
    MoveTCPStep,
    Step,
    TaskContext,
    WaitStep,
)

if TYPE_CHECKING:
    from core.base_node import BaseNode
    from core.joint_state_cache import JointStateCache
    from modules.dynamixel.motor_config import MotorConfig
    from modules.camera.capture import CameraCapture


logger = logging.getLogger(__name__)


TRAJ_WAIT_TIMEOUT = 30.0

# 색상 감지 상수 (HSV) — YOLO로 교체 시 _detect() 내부만 수정
HSV_LOWER = (35, 100, 100)   # 초록색 계열 하한
HSV_UPPER = (85, 255, 255)   # 초록색 계열 상한
MIN_AREA_PX = 500            # 최소 blob 면적 (px²)
ASSUMED_Z_M = 0.02           # 물체 높이 가정 (바닥 기준, meters)


class StepExecutor:
    def __init__(
        self,
        node: "BaseNode",
        joint_cache: "JointStateCache",
        arm_cfgs: list["MotorConfig"],
        camera: "CameraCapture | None" = None,
        calibration: CalibrationData | None = None,
    ) -> None:
        self._node = node
        self._joint_cache = joint_cache
        self._arm_cfgs = arm_cfgs
        self._camera = camera
        self._calib = calibration

        self._traj_event = threading.Event()
        self._traj_status = TrajStatus.IDLE

        self._node.create_subscriber(
            Topic.MOTION_STATE_TRAJ,
            self._on_traj_state,
        )

    # ─── Execute ─────────────────────────────────────────────────

    def execute(self, step: Step, context: TaskContext) -> bool:
        match step.type:
            case "move_tcp":
                return self._move_tcp(step, context)
            case "gripper":
                return self._gripper(step)
            case "detect":
                return self._detect(step, context)
            case "wait":
                return self._wait(step)
            case "home":
                return self._home(step)
            case _:
                logger.error("알 수 없는 step type: %s", step.type)
                return False

    # ─── Step 구현 ─────────────────────────────────────────────────

    def _move_tcp(self, step: MoveTCPStep, context: TaskContext) -> bool:
        if step.position_key is not None:
            base_pos = context.get(step.position_key)
            if base_pos is None:
                logger.error("MoveTCPStep: context에 '%s' 없음",
                             step.position_key)
                return False
            position = [b + o for b, o in zip(base_pos, step.offset)]
        else:
            position = [b + o for b, o in zip(step.position, step.offset)]

        logger.info("MoveL → %.3f, %.3f, %.3f  [%s]", *position, step.label)

        self._traj_event.clear()
        res = self._node.call_service(
            Service.MOTION_MOVE_L,
            {"position": position},
        )
        if not res.get("success"):
            logger.error("MoveL 서비스 실패: %s", res.get("message"))
            return False

        return self._wait_for_traj()

    def _gripper(self, step: GripperStep) -> bool:
        logger.info(
            "Gripper %s  current=%d  [%s]", step.action, step.current, step.label)

        res = self._node.call_service(
            Service.MOTOR_GRIPPER,
            {"action": step.action, "current": step.current},
        )
        if not res.get("success"):
            logger.error("Gripper 서비스 실패: %s", res.get("message"))
            return False

        time.sleep(GRIPPER_SETTLE)
        return True

    def _detect(self, step: DetectStep, context: TaskContext) -> bool:
        # ── 사전 조건 확인 ───────────────────────
        if self._camera is None:
            logger.error("DetectStep: camera 없음")
            return False

        if self._calib is None or not self._calib.is_ready():
            logger.error("DetectStep: 캘리브레이션 미완료")
            return False

        logger.info("Detect 시작  [%s]", step.label)

        # ── 카메라 프레임 취득 ────────────────────
        frame = self._camera.read()
        if frame is None:
            logger.error("DetectStep: 카메라 프레임 취득 실패")
            return False

        # ── 색상 마스킹 → blob centroid ───────────
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(
            hsv,
            np.array(HSV_LOWER, dtype=np.uint8),
            np.array(HSV_UPPER, dtype=np.uint8),
        )

        # 노이즈 제거
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            logger.error("DetectStep: 색상 기반 물체 감지 실패")
            return False

        # 가장 큰 contour 선택
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < MIN_AREA_PX:
            logger.error("DetectStep: blob 면적 너무 작음 (%.0fpx²)",
                         cv2.contourArea(largest))
            return False

        M = cv2.moments(largest)
        cx = M["m10"] / M["m00"]   # image centroid u
        cy = M["m01"] / M["m00"]   # image centroid v

        logger.info("DetectStep: blob centroid (%.1f, %.1f)", cx, cy)

        # ── image → camera frame ──────────────────
        # undistort → 정규화 좌표
        camera_matrix = self._calib.intrinsic.camera_matrix
        dist_coeffs = self._calib.intrinsic.dist_coeffs

        pt_distorted = np.array([[[cx, cy]]], dtype=np.float32)
        pt_undistorted = cv2.undistortPoints(
            pt_distorted, camera_matrix, dist_coeffs)
        xn = float(pt_undistorted[0, 0, 0])   # 정규화 x
        yn = float(pt_undistorted[0, 0, 1])   # 정규화 y

        # 바닥 평면 Z = ASSUMED_Z_M (카메라 프레임 기준 깊이)
        # 실제 depth를 모르므로 물체가 바닥에 있다고 가정
        # 추후 depth camera / YOLO + depth 로 개선 가능
        fx = camera_matrix[0, 0]
        fy = camera_matrix[1, 1]
        cx_ = camera_matrix[0, 2]
        cy_ = camera_matrix[1, 2]

        # 카메라 프레임에서 물체까지의 거리를 Z로 가정
        # (정규화 좌표 * Z = 실제 X, Y)
        Z_cam = ASSUMED_Z_M
        X_cam = xn * Z_cam
        Y_cam = yn * Z_cam
        obj_in_cam = np.array([X_cam, Y_cam, Z_cam])

        # ── hand-eye: camera frame → end-effector frame ──
        R_ce = self._calib.hand_eye.R            # (3,3)
        t_ce = self._calib.hand_eye.t.flatten()  # (3,)
        obj_in_ee = R_ce @ obj_in_cam + t_ce

        # ── FK: end-effector frame → base frame ──
        res = self._node.call_service(Service.MOTION_GET_TCP, {})
        if not res.get("success"):
            logger.error("DetectStep: get_tcp 실패: %s", res.get("message"))
            return False

        tcp_data = res.get("data", {})
        pos = tcp_data.get("position")     # [x, y, z]
        quat = tcp_data.get("quaternion")  # [x, y, z, w]

        if pos is None or quat is None:
            logger.error("DetectStep: TCP pose 없음")
            return False

        R_be = _quat_to_rot(quat)
        t_be = np.array(pos)
        obj_in_base = R_be @ obj_in_ee + t_be

        logger.info(
            "DetectStep: 감지 성공 | cam=(%.3f,%.3f,%.3f) → base=(%.3f,%.3f,%.3f)",
            *obj_in_cam, *obj_in_base,
        )

        context.set(step.output_key, obj_in_base.tolist())
        return True

    def _wait(self, step: WaitStep) -> bool:
        logger.info("Wait %.2fs  [%s]", step.duration_sec, step.label)
        time.sleep(step.duration_sec)
        return True

    def _home(self, step: HomeStep) -> bool:
        logger.info("Home으로 복귀")

        home_joints = [
            {"id": cfg.id, "degree": 0.0}
            for cfg in self._arm_cfgs
        ]

        self._traj_event.clear()
        res = self._node.call_service(
            Service.MOTION_MOVE_J,
            {"joints": home_joints},
        )
        if not res.get("success"):
            logger.error("Home MoveJ 실패: %s", res.get("message"))
            return False

        return self._wait_for_traj()

    # ─── 내부 유틸 ─────────────────────────────────────────────────

    def _on_traj_state(self, data: dict) -> None:
        status = data.get("status", "")
        self._traj_status = status
        if status in (TrajStatus.DONE, TrajStatus.FAILED, TrajStatus.STOPPED):
            self._traj_event.set()

    def _wait_for_traj(self, timeout: float = TRAJ_WAIT_TIMEOUT) -> bool:
        triggered = self._traj_event.wait(timeout=timeout)
        if not triggered:
            logger.warning("궤적 대기 timeout (%.0fs)", timeout)
            return False
        return self._traj_status == TrajStatus.DONE

# ─────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────


def _quat_to_rot(quat: list[float]) -> np.ndarray:
    """quaternion [x, y, z, w] → 3x3 회전 행렬."""
    x, y, z, w = quat
    return np.array([
        [1 - 2*(y*y + z*z),   2*(x*y - z*w),     2*(x*z + y*w)],
        [2*(x*y + z*w),       1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w),       2*(y*z + x*w),     1 - 2*(x*x + y*y)],
    ], dtype=np.float64)
