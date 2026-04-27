import time
import logging
import threading
from enum import Enum

import numpy as np

from core.base_node import BaseNode
from core.topic_map import Service, Topic
from core.joint_state_cache import JointStateCache
from core.units import deg_to_rad, rad_to_raw
from modules.dynamixel.motor_config import MotorConfig, load_motor_config
from modules.kinematics.motion_modes import MotionModes

logger = logging.getLogger(__name__)

GRIPPER_ID = 6
MOVEL_FREQ = 50  # Hz (waypoint 간격 20ms)
_T_ACCEL = 0.20
_T_DECEL = 0.20

# IK 연산 초과 경고 (50Hz → dt=20ms)
_IK_WARN_THRESHOLD = 1.0 / MOVEL_FREQ * 0.8  # dt의 80% = 16ms

# MoveL 종료 후 Profile 복원 값
_DEFAULT_PROFILE_VEL = 150
_DEFAULT_PROFILE_ACC = 40


class TrajStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    STOPPED = "stopped"
    FAILED = "failed"


class MotionNode(BaseNode):
    def __init__(self):
        super().__init__("motion_node")

        _, self._motor_cfgs = load_motor_config()
        self._arm_cfgs: list[MotorConfig] = [
            m for m in self._motor_cfgs if m.id != GRIPPER_ID
        ]
        self._arm_ids = [cfg.id for cfg in self._arm_cfgs]

        self._motion = MotionModes()
        self._cache = JointStateCache()
        self._cache.subscribe(self)

        self._traj_thread: threading.Thread | None = None
        self._traj_stop = threading.Event()

        self.create_service(Service.MOTION_GET_TCP, self._srv_get_tcp)
        self.create_service(Service.MOTION_MOVE_TCP, self._srv_move_tcp)
        self.create_service(Service.MOTION_ORBIT_SET, self._srv_orbit_set)
        self.create_service(Service.MOTION_ORBIT_ROTATE, self._srv_orbit_rotate)
        self.create_service(Service.MOTION_ORBIT_CLEAR, self._srv_orbit_clear)
        self.create_service(Service.MOTION_MOVE_L, self._srv_move_l)
        self.create_service(Service.MOTION_STOP, self._srv_stop)

    # ─── 단위 변환 ────────────────────────────────────────────

    def _joint_angles_rad_to_cmd(self, angles_rad: list[float]) -> list[dict]:
        return [
            {
                "id": cfg.id,
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
        self.publish(Topic.MOTOR_CMD_JOINT, {"timestamp": time.time(), "joints": cmds})

    def _publish_traj_state(self, status: TrajStatus, progress: float) -> None:
        self.publish(
            Topic.MOTION_STATE_TRAJ,
            {
                "status": status.value,
                "progress": round(progress, 3),
                "timestamp": time.time(),
            },
        )

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
                "data": {"position": pose.position, "quaternion": pose.quaternion},
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
                "info", f"Orbit center 설정: {[f'{v:.3f}' for v in pose.position]}"
            )
            return {
                "success": True,
                "message": "ok",
                "data": {"position": pose.position, "quaternion": pose.quaternion},
            }
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_rotate(self, req: dict) -> dict:
        data = req.get("data", {})
        delta_pitch_deg = data.get("delta_pitch", 0.0)
        delta_yaw_deg = data.get("delta_yaw", 0.0)

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
                return {
                    "success": False,
                    "message": "IK 수렴 실패 (관절 한계)",
                    "data": {},
                }
            self._publish_cmd(result)
            return {"success": True, "message": "ok", "data": {}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_clear(self, req: dict) -> dict:
        self._motion.orbit_clear()
        self.log("info", "Orbit 모드 해제")
        return {"success": True, "message": "ok", "data": {}}

    # ─── MoveL ─────────────────────────────────────────────────

    def _srv_move_l(self, req: dict) -> dict:
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
        was_running = self._traj_thread and self._traj_thread.is_alive()
        self._stop_trajectory()
        if was_running:
            self._publish_traj_state(TrajStatus.STOPPED, 0.0)
            self.log("info", "트래젝토리 중단")
        return {"success": True, "message": "ok", "data": {}}

    def _stop_trajectory(self) -> None:
        if self._traj_thread and self._traj_thread.is_alive():
            self._traj_stop.set()
            self._traj_thread.join(timeout=2.0)
        self._traj_thread = None
        self._traj_stop.clear()

    def _set_arm_profile(self, velocity: int, acceleration: int) -> bool:
        res = self.call_service(
            Service.MOTOR_SET_PROFILE_ALL,
            {
                "ids": self._arm_ids,
                "velocity": velocity,
                "acceleration": acceleration,
            },
        )
        return res.get("success", False)

    def _run_move_l(
        self,
        start_pos: list[float],
        end_pos: list[float],
        duration: float,
        start_angles: list[float],
    ) -> None:
        """
        MoveL (time-based streaming cartesian motion)

        flow:
        time → t_norm → s(t) → TCP → IK → joint cmd

        space sampling (dt fixed, speed varies):

        A ●  ●   ●    ●     ●      ●     ●    ●   ●  B
        accel     cruise (uniform)       decel
        (촘촘→벌어짐→촘촘)

        특징:
        - TCP 직선 경로 보장 (Cartesian path)
        - 50Hz time-based waypoint streaming
        - s(t): trapezoidal velocity profile (accel/cruise/decel)
        - IK 기반 real-time joint generation
        - spacing 변화는 속도 변화의 결과

        주의:
        - waypoint spacing 불균일 (시간 기준 샘플링 구조)
        - IK latency가 전체 안정성에 직접 영향
        - dt 깨지면 trajectory distortion 발생
        - 긴 거리 + 짧은 시간 = coarse sampling 위험

        개선:
        - Ruckig: joint-space trajectory + jerk 제한 + adaptive timing
        - MoveIt: constraint-based global planning + smoothing
        - (또는) distance-based resampling → uniform spatial resolution
        """
        dt = 1.0 / MOVEL_FREQ
        n_steps = max(1, int(duration * MOVEL_FREQ))
        start = np.array(start_pos, dtype=float)
        end = np.array(end_pos, dtype=float)

        current_angles = list(start_angles)

        # Profile vel=0, acc=0 → 내장 프로파일 비활성화
        ok = self._set_arm_profile(velocity=0, acceleration=0)
        if not ok:
            logger.warning("MoveL: profile 비활성화 실패 — 계속 진행")

        t_start = time.time()

        try:
            for i in range(n_steps):
                if self._traj_stop.is_set():
                    self._publish_traj_state(TrajStatus.STOPPED, (i + 1) / n_steps)
                    return

                t_norm = (i + 1) / n_steps
                s = self._trapezoid_s(t_norm, _T_ACCEL, _T_DECEL)
                waypoint = (start + s * (end - start)).tolist()

                ik_t0 = time.time()
                result = self._motion.move_tcp(waypoint, current_angles)
                ik_dt = time.time() - ik_t0
                if ik_dt > _IK_WARN_THRESHOLD:
                    logger.warning(
                        f"MoveL IK 느림 | {ik_dt * 1000:.1f}ms > {_IK_WARN_THRESHOLD * 1000:.0f}ms "
                        f"(step={i + 1}/{n_steps})"
                    )

                if result is None:
                    logger.warning(
                        f"MoveL IK 실패 | step={i + 1}/{n_steps} "
                        f"| waypoint={[f'{v:.4f}' for v in waypoint]}"
                    )
                    self._publish_traj_state(TrajStatus.FAILED, t_norm)
                    return

                current_angles = result
                self._publish_cmd(result)
                self._publish_traj_state(TrajStatus.RUNNING, t_norm)

                next_t = t_start + (i + 1) * dt
                sleep_time = next_t - time.time()
                if sleep_time > 0:
                    time.sleep(sleep_time)

            self._publish_traj_state(TrajStatus.DONE, 1.0)
            self.log("info", "MoveL 완료")

        finally:
            ok = self._set_arm_profile(
                velocity=_DEFAULT_PROFILE_VEL,
                acceleration=_DEFAULT_PROFILE_ACC,
            )
            if not ok:
                logger.warning("MoveL: profile 복원 실패")

    @staticmethod
    def _trapezoid_s(t: float, t_a: float, t_d: float) -> float:
        t_c = 1.0 - t_a - t_d
        peak = 1.0 / (t_a / 2.0 + t_c + t_d / 2.0)
        if t <= t_a:
            return peak * (t**2) / (2.0 * t_a)
        elif t <= t_a + t_c:
            return peak * (t_a / 2.0 + (t - t_a))
        else:
            t_rem = 1.0 - t
            return 1.0 - peak * (t_rem**2) / (2.0 * t_d)
