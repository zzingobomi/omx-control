import logging
from typing import TYPE_CHECKING
import cv2
import numpy as np

from core.common import GRIPPER_ID
from core.base_node import BaseNode
from core.joint_state_cache import JointStateCache
from core.topic_map import Service
from modules.calibration.loader import load_calibration
from modules.detector.color_detector import ColorDetector
from modules.dynamixel.motor_config import MotorConfig, load_motor_config

if TYPE_CHECKING:
    from modules.camera.capture import CameraCapture

logger = logging.getLogger(__name__)

# 바닥 기준 물체 높이 가정 (meters)
# 실제 물체 높이에 맞게 조정 (종이컵 ~8cm, 페트병 ~20cm 등)
ASSUMED_Z_M = 0.02


class DetectorNode(BaseNode):
    def __init__(
        self,
        camera: "CameraCapture",
    ) -> None:
        super().__init__("detector_node")

        self._camera = camera
        _, self._motor_cfgs = load_motor_config()
        self._arm_cfgs: list[MotorConfig] = [
            m for m in self._motor_cfgs if m.id != GRIPPER_ID
        ]
        self._joint_cache = JointStateCache()

        self._calib = load_calibration()
        if not self._calib.is_ready():
            logger.warning(
                "DetectorNode: 캘리브레이션 미완료 (intrinsic=%s, hand_eye=%s)",
                self._calib.intrinsic is not None,
                self._calib.hand_eye is not None,
            )

        self._detector = ColorDetector()

    def start(self) -> None:
        self._joint_cache.subscribe(self)
        self.create_service(Service.DETECT_SERVICE, self._handle_detect)
        super().start()
        logger.info("DetectorNode 시작")

    # ── Service handler ───────────────────────────────────────

    def _handle_detect(self, req: dict) -> dict:
        if not self._calib.is_ready():
            return {"success": False, "message": "캘리브레이션 미완료", "data": {}}

        # ── 카메라 프레임 취득 ────────────────────
        frame = self._camera.read()
        if frame is None:
            return {"success": False, "message": "카메라 프레임 취득 실패", "data": {}}

        # ── 물체 감지 → image centroid ────────────
        result = self._detector.detect(frame)
        if result is None:
            return {"success": False, "message": "물체 감지 실패", "data": {}}

        cx, cy = result
        logger.info("감지: centroid (%.1f, %.1f)", cx, cy)

        # ── image → camera frame ──────────────────
        camera_matrix = self._calib.intrinsic.camera_matrix
        dist_coeffs = self._calib.intrinsic.dist_coeffs

        pt = np.array([[[cx, cy]]], dtype=np.float32)
        pt_undistorted = cv2.undistortPoints(pt, camera_matrix, dist_coeffs)
        xn = float(pt_undistorted[0, 0, 0])
        yn = float(pt_undistorted[0, 0, 1])

        Z_cam = ASSUMED_Z_M
        obj_in_cam = np.array([xn * Z_cam, yn * Z_cam, Z_cam])

        # ── hand-eye: camera → end-effector ──────
        R_ce = self._calib.hand_eye.R
        t_ce = self._calib.hand_eye.t.flatten()
        obj_in_ee = R_ce @ obj_in_cam + t_ce

        # ── FK: end-effector → base frame ─────────
        res = self.call_service(Service.MOTION_GET_TCP, {})
        if not res.get("success"):
            return {
                "success": False,
                "message": f"get_tcp 실패: {res.get('message')}",
                "data": {},
            }

        tcp_data = res.get("data", {})
        pos = tcp_data.get("position")
        quat = tcp_data.get("quaternion")

        if pos is None or quat is None:
            return {"success": False, "message": "TCP pose 없음", "data": {}}

        R_be = _quat_to_rot(quat)
        t_be = np.array(pos)
        obj_in_base = R_be @ obj_in_ee + t_be

        logger.info(
            "감지 완료: base=(%.3f, %.3f, %.3f)",
            *obj_in_base,
        )

        return {
            "success": True,
            "message": "ok",
            "data": {"position": obj_in_base.tolist()},
        }


# ─────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────


def _quat_to_rot(quat: list[float]) -> np.ndarray:
    """quaternion [x, y, z, w] → 3x3 회전 행렬."""
    x, y, z, w = quat
    return np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ],
        dtype=np.float64,
    )
