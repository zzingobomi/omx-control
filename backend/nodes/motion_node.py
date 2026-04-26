import time
import logging
import threading

import numpy as np

from core.base_node import BaseNode
from core.topic_map import Service, Topic
from core.joint_state_cache import JointStateCache
from core.units import deg_to_rad, rad_to_raw
from modules.dynamixel.motor_config import MotorConfig, load_motor_config
from modules.kinematics.motion_modes import MotionModes

logger = logging.getLogger(__name__)

GRIPPER_ID = 6

# MoveL 실행 주파수 (Hz)
MOVEL_FREQ = 20

# Trapezoidal profile 비율
_T_ACCEL = 0.20   # 가속 구간
_T_DECEL = 0.20   # 감속 구간
_T_CRUISE = 1.0 - _T_ACCEL - _T_DECEL

# MoveL 시 모터 profile 설정 (waypoint 추종용 빠른 응답)
MOVEL_PROFILE_VEL = 200   # ≈ 45.8 rpm
MOVEL_PROFILE_ACC = 50    # ≈ 10728 rev/min²


class MotionNode(BaseNode):
    def __init__(self):
        super().__init__("motion_node")

        _, self._motor_cfgs = load_motor_config()
        self._arm_cfgs: list[MotorConfig] = [
            m for m in self._motor_cfgs if m.id != GRIPPER_ID
        ]

        self._motion = MotionModes()
        self._cache = JointStateCache()
        self._cache.subscribe(self)

        # 트래젝토리 실행 상태
        self._traj_thread: threading.Thread | None = None
        self._traj_stop = threading.Event()

        self.create_service(Service.MOTION_GET_TCP,      self._srv_get_tcp)
        self.create_service(Service.MOTION_MOVE_TCP,     self._srv_move_tcp)
        self.create_service(Service.MOTION_ORBIT_SET,    self._srv_orbit_set)
        self.create_service(Service.MOTION_ORBIT_ROTATE,
                            self._srv_orbit_rotate)
        self.create_service(Service.MOTION_ORBIT_CLEAR,  self._srv_orbit_clear)
        self.create_service(Service.MOTION_MOVE_L,       self._srv_move_l)
        self.create_service(Service.MOTION_STOP,         self._srv_stop)

    # ─── 단위 변환 ────────────────────────────────────────────

    def _joint_angles_rad_to_cmd(self, angles_rad: list[float]) -> list[dict]:
        return [
            {
                "id":       cfg.id,
                "position": rad_to_raw(
                    angle_rad,
                    reverse=cfg.reverse,
                    min_raw=cfg.limit_min,
                    max_raw=cfg.limit_max,
                ),
            }
            for cfg, angle_rad in zip(self._arm_cfgs, angles_rad)
        ]

    def _publish_cmd(self, angles_rad: list[float]) -> None:
        cmds = self._joint_angles_rad_to_cmd(angles_rad)
        self.publish(Topic.MOTOR_CMD_JOINT, {
                     "timestamp": time.time(), "joints": cmds})

    def _publish_traj_state(self, status: str, progress: float) -> None:
        self.publish(Topic.MOTION_STATE_TRAJ, {
            "status":    status,
            "progress":  round(progress, 3),
            "timestamp": time.time(),
        })

    # ─── 트래젝토리 관리 ──────────────────────────────────────

    def _stop_trajectory(self) -> None:
        """실행 중인 트래젝토리를 중단하고 스레드가 종료될 때까지 대기."""
        if self._traj_thread and self._traj_thread.is_alive():
            self._traj_stop.set()
            self._traj_thread.join(timeout=2.0)
        self._traj_thread = None
        self._traj_stop.clear()

    # ─── Services ─────────────────────────────────────────────

    def _srv_get_tcp(self, req: dict) -> dict:
        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}
        try:
            pose = self._motion.get_tcp_pose(angles)
            return {
                "success": True,
                "message": "ok",
                "data":    {"position": pose.position, "quaternion": pose.quaternion},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_move_tcp(self, req: dict) -> dict:
        data = req.get("data", {})
        target_pos = data.get("position")
        if target_pos is None:
            return {"success": False, "message": "position 필요", "data": {}}

        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}

        try:
            result = self._motion.move_tcp(target_pos, angles)
            if result is None:
                logger.warning(
                    f"IK 실패 | target: {[f'{v:.4f}' for v in target_pos]} "
                    f"| angles(rad): {[f'{v:.4f}' for v in angles]}"
                )
                return {"success": False, "message": "IK 수렴 실패", "data": {}}
            self._publish_cmd(result)
            return {"success": True, "message": "ok", "data": {}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_set(self, req: dict) -> dict:
        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}
        try:
            pose = self._motion.orbit_set(angles)
            self.log(
                "info", f"Orbit center 설정: {[f'{v:.3f}' for v in pose.position]}")
            return {
                "success": True,
                "message": "ok",
                "data":    {"position": pose.position, "quaternion": pose.quaternion},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_rotate(self, req: dict) -> dict:
        data = req.get("data", {})
        delta_pitch_deg = data.get("delta_pitch", 0.0)
        delta_yaw_deg = data.get("delta_yaw",   0.0)

        if not self._motion.orbit_active:
            return {"success": False, "message": "orbit center 미설정", "data": {}}

        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}

        try:
            result = self._motion.orbit_rotate(
                delta_elevation=deg_to_rad(delta_pitch_deg),
                delta_azimuth=deg_to_rad(delta_yaw_deg),
                current_joint_angles=angles,
            )
            if result is None:
                return {"success": False, "message": "IK 수렴 실패 (관절 한계)", "data": {}}
            self._publish_cmd(result)
            return {"success": True, "message": "ok", "data": {}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_clear(self, req: dict) -> dict:
        self._motion.orbit_clear()
        self.log("info", "Orbit 모드 해제")
        return {"success": True, "message": "ok", "data": {}}

    def _srv_move_l(self, req: dict) -> dict:
        """
        MoveL: TCP 직선 보간 (Trapezoidal velocity profile).

        Request data:
            position : [x, y, z]  (미터 단위, URDF 기준)
            duration : float      (초, 0.5 ~ 30.0)
        """
        data = req.get("data", {})
        target_pos = data.get("position")
        duration = float(data.get("duration", 3.0))
        duration = max(0.5, min(30.0, duration))

        if target_pos is None:
            return {"success": False, "message": "position 필요", "data": {}}

        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}

        try:
            start_pose = self._motion.get_tcp_pose(angles)
            start_pos = list(start_pose.position)
            target_list = list(target_pos)

            # 기존 트래젝토리 중단
            self._stop_trajectory()

            self._traj_thread = threading.Thread(
                target=self._run_move_l,
                args=(start_pos, target_list, duration, list(angles)),
                name="movel-traj",
                daemon=True,
            )
            self._traj_thread.start()

            self.log(
                "info",
                f"MoveL 시작 | {[f'{v:.3f}' for v in start_pos]} → "
                f"{[f'{v:.3f}' for v in target_list]} | duration={duration:.1f}s",
            )
            return {"success": True, "message": "ok", "data": {"duration": duration}}

        except Exception as e:
            logger.error(f"MoveL 시작 오류: {e}")
            return {"success": False, "message": str(e), "data": {}}

    def _srv_stop(self, req: dict) -> dict:
        """실행 중인 트래젝토리(MoveL) 즉시 중단."""
        was_running = self._traj_thread and self._traj_thread.is_alive()
        self._stop_trajectory()
        if was_running:
            self._publish_traj_state("stopped", 0.0)
            self.log("info", "트래젝토리 중단")
        return {"success": True, "message": "ok", "data": {}}

    # ─── MoveL 실행 스레드 ────────────────────────────────────

    def _run_move_l(
        self,
        start_pos:     list[float],
        end_pos:       list[float],
        duration:      float,
        start_angles:  list[float],
    ) -> None:
        """
        Trapezoidal velocity profile로 직선 경로를 분할하여 20Hz로 cmd 발행.
        IK 실패 시 즉시 중단.
        """
        dt = 1.0 / MOVEL_FREQ
        n_steps = max(1, int(duration * MOVEL_FREQ))

        start = np.array(start_pos, dtype=float)
        end = np.array(end_pos,   dtype=float)

        current_angles = list(start_angles)
        t_start = time.time()

        # MoveL 동안 모터 profile velocity 를 빠른 응답 값으로 일시 설정
        # (motor_node에 직접 접근하지 않고 MOTOR_SET_PROFILE 서비스 호출 대신
        #  MOTOR_CMD_JOINT 에 profile 필드를 포함시키는 방식은 현재 미지원이므로
        #  여기서는 profile을 건드리지 않고 waypoint 간격으로 제어함)

        for i in range(n_steps):
            if self._traj_stop.is_set():
                self._publish_traj_state("stopped", (i + 1) / n_steps)
                return

            # 트래젝토리 파라미터 t ∈ (0, 1]
            t_normalized = (i + 1) / n_steps
            s = self._trapezoid_s(t_normalized, _T_ACCEL, _T_DECEL)

            waypoint = (start + s * (end - start)).tolist()

            result = self._motion.move_tcp(waypoint, current_angles)
            if result is None:
                logger.warning(
                    f"MoveL IK 실패 | step={i+1}/{n_steps} "
                    f"| waypoint={[f'{v:.4f}' for v in waypoint]}"
                )
                self._publish_traj_state("failed", t_normalized)
                return

            current_angles = result
            self._publish_cmd(result)
            self._publish_traj_state("running", t_normalized)

            # 다음 스텝 타이밍까지 정밀 대기
            next_t = t_start + (i + 1) * dt
            sleep_time = next_t - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)

        self._publish_traj_state("done", 1.0)
        self.log("info", "MoveL 완료")

    @staticmethod
    def _trapezoid_s(t: float, t_a: float, t_d: float) -> float:
        """
        t ∈ [0, 1] → 변위 비율 s ∈ [0, 1] (사다리꼴 속도 프로파일 적분).

        t_a : 가속 구간 비율
        t_d : 감속 구간 비율
        """
        t_c = 1.0 - t_a - t_d  # 등속 구간 비율
        # 면적(= 총 변위)이 1이 되도록 peak 속도를 정규화
        peak = 1.0 / (t_a / 2.0 + t_c + t_d / 2.0)

        if t <= t_a:
            # 가속 구간: 포물선
            return peak * (t ** 2) / (2.0 * t_a)
        elif t <= t_a + t_c:
            # 등속 구간: 선형
            return peak * (t_a / 2.0 + (t - t_a))
        else:
            # 감속 구간: 역 포물선
            t_rem = 1.0 - t
            return 1.0 - peak * (t_rem ** 2) / (2.0 * t_d)
