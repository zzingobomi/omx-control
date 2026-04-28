import time
import logging
import threading
from enum import Enum

import numpy as np
from ruckig import Ruckig, InputParameter, OutputParameter, Result

from core.base_node import BaseNode
from core.topic_map import Service, Topic
from core.joint_state_cache import JointStateCache
from core.units import deg_to_rad, rad_to_raw
from modules.dynamixel.motor_config import MotorConfig, load_motor_config
from modules.kinematics.motion_modes import MotionModes

logger = logging.getLogger(__name__)

GRIPPER_ID = 6
TRAJ_FREQ = 50  # Hz — MoveJ / MoveL 공통 루프 주기
TRAJ_DT = 1.0 / TRAJ_FREQ  # 20ms

# ── MoveJ 관절 제약 (id 순서: 1,2,3,4,5) ──────────────────────
# XL430(1~3): max ~41 rpm ≈ 4.3 rad/s
# XL330(4~5): max ~61 rpm ≈ 6.4 rad/s
# 안정성 / 정밀도 우선 세팅 (soft motion profile)
# - velocity ~35% 수준 제한
# - acceleration / jerk 추가 감속으로 부드러운 움직임 보장
_J_MAX_VEL = [1.5, 1.5, 1.5, 2.5, 2.5]
_J_MAX_ACC = [3.0, 3.0, 3.0, 5.0, 5.0]
_J_MAX_JERK = [10.0, 10.0, 10.0, 20.0, 20.0]

# ── MoveL 경로 제약 (1D path parameter, 단위: 미터) ────────────
_L_MAX_VEL = 0.10  # m/s   (10 cm/s)
_L_MAX_ACC = 0.25  # m/s²
_L_MAX_JERK = 1.00  # m/s³

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
        self._n_arm = len(self._arm_cfgs)

        self._motion = MotionModes()
        self._cache = JointStateCache()
        self._cache.subscribe(self)

        self._traj_thread: threading.Thread | None = None
        self._traj_stop = threading.Event()

        self.create_service(Service.MOTION_GET_TCP, self._srv_get_tcp)
        self.create_service(Service.MOTION_MOVE_TCP, self._srv_move_tcp)
        self.create_service(Service.MOTION_MOVE_J, self._srv_move_j)
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
                "status": status,
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

    # ─── Trajectory ────────────────────────────────────────────

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

    def _start_traj_thread(self, target, args: tuple, name: str) -> None:
        self._stop_trajectory()
        self._traj_thread = threading.Thread(
            target=target,
            args=args,
            name=name,
            daemon=True,
        )
        self._traj_thread.start()

    # ─── MoveJ ─────────────────────────────────────────────────

    def _srv_move_j(self, req: dict) -> dict:
        data = req.get("data", {})
        target_joints = data.get("joints", [])
        if not target_joints:
            return {"success": False, "message": "joints 필요", "data": {}}

        current_angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if current_angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}

        target_by_id = {int(j["id"]): float(j["degree"]) for j in target_joints}
        target_angles = [
            deg_to_rad(target_by_id.get(cfg.id, 0.0)) for cfg in self._arm_cfgs
        ]

        self._start_traj_thread(
            target=self._run_move_j,
            args=(list(current_angles), target_angles),
            name="movej-traj",
        )

        self.log(
            "info",
            f"MoveJ 시작 | target={[f'{d:.1f}°' for d in target_by_id.values()]}",
        )
        return {"success": True, "message": "ok", "data": {}}

    def _run_move_j(
        self,
        start_angles: list[float],
        target_angles: list[float],
    ) -> None:
        ok = self._set_arm_profile(velocity=0, acceleration=0)
        if not ok:
            logger.warning("MoveJ: profile 비활성화 실패 — 계속 진행")

        otg = Ruckig(self._n_arm, TRAJ_DT)
        inp = InputParameter(self._n_arm)
        out = OutputParameter(self._n_arm)

        inp.current_position = list(start_angles)
        inp.current_velocity = [0.0] * self._n_arm  # 정지 상태에서 출발
        inp.current_acceleration = [0.0] * self._n_arm
        inp.target_position = list(target_angles)
        inp.target_velocity = [0.0] * self._n_arm  # 정지 상태로 도착
        inp.target_acceleration = [0.0] * self._n_arm
        inp.max_velocity = list(_J_MAX_VEL)
        inp.max_acceleration = list(_J_MAX_ACC)
        inp.max_jerk = list(_J_MAX_JERK)

        first_result = otg.update(inp, out)
        est_duration = out.trajectory.duration
        t_start = time.time()

        try:
            # 첫 번째 step 명령 발행
            self._publish_cmd(list(out.new_position))
            self._publish_traj_state("running", 0.0)

            if first_result == Result.Finished:
                self._publish_traj_state("done", 1.0)
                self.log("info", f"MoveJ 완료 (즉시, {est_duration * 1000:.0f}ms)")
                return

            # 이후 step 루프
            inp.current_position = list(out.new_position)
            inp.current_velocity = list(out.new_velocity)
            inp.current_acceleration = list(out.new_acceleration)

            while True:
                if self._traj_stop.is_set():
                    self._publish_traj_state("stopped", 0.0)
                    return

                next_t = t_start + (time.time() - t_start) + TRAJ_DT
                result = otg.update(inp, out)
                elapsed = time.time() - t_start
                progress = min(elapsed / est_duration, 1.0) if est_duration > 0 else 1.0

                self._publish_cmd(list(out.new_position))
                self._publish_traj_state("running", progress)

                if result == Result.Finished:
                    self._publish_traj_state("done", 1.0)
                    self.log("info", f"MoveJ 완료 ({elapsed * 1000:.0f}ms)")
                    return

                if result == Result.Error:
                    logger.error("MoveJ Ruckig 오류")
                    self._publish_traj_state("failed", progress)
                    return

                inp.current_position = list(out.new_position)
                inp.current_velocity = list(out.new_velocity)
                inp.current_acceleration = list(out.new_acceleration)

                sleep_time = next_t - time.time()
                if sleep_time > 0:
                    time.sleep(sleep_time)
        finally:
            ok = self._set_arm_profile(
                velocity=_DEFAULT_PROFILE_VEL,
                acceleration=_DEFAULT_PROFILE_ACC,
            )
            if not ok:
                logger.warning("MoveJ: profile 복원 실패")

    # ─── MoveL ─────────────────────────────────────────────────

    def _srv_move_l(self, req: dict) -> dict:
        data = req.get("data", {})
        target_pos = data.get("position")
        if target_pos is None:
            return {"success": False, "message": "position 필요", "data": {}}

        angles = self._cache.get_joint_angles_rad(self._arm_cfgs)
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}

        try:
            start_pose = self._motion.get_tcp_pose(angles)
            start_pos = list(start_pose.position)
            target_list = list(target_pos)
            distance = float(
                np.linalg.norm(np.array(target_list) - np.array(start_pos))
            )

            if distance < 1e-4:
                return {"success": True, "message": "이미 목표 위치", "data": {}}

            self._start_traj_thread(
                target=self._run_move_l,
                args=(start_pos, target_list, distance, list(angles)),
                name="movel-traj",
            )

            self.log(
                "info",
                f"MoveL 시작 | {[f'{v:.3f}' for v in start_pos]} → "
                f"{[f'{v:.3f}' for v in target_list]} | dist={distance * 100:.1f}cm",
            )
            return {"success": True, "message": "ok", "data": {}}

        except Exception as e:
            logger.error(f"MoveL 시작 오류: {e}")
            return {"success": False, "message": str(e), "data": {}}

    def _run_move_l(
        self,
        start_pos: list[float],
        end_pos: list[float],
        distance: float,
        start_angles: list[float],
    ) -> None:
        ok = self._set_arm_profile(velocity=0, acceleration=0)
        if not ok:
            logger.warning("MoveL: profile 비활성화 실패 — 계속 진행")

        start = np.array(start_pos, dtype=float)
        end = np.array(end_pos, dtype=float)

        # 1D Ruckig (path parameter = 실제 이동 거리, 단위 m)
        otg = Ruckig(1, TRAJ_DT)
        inp = InputParameter(1)
        out = OutputParameter(1)

        inp.current_position = [0.0]
        inp.current_velocity = [0.0]
        inp.current_acceleration = [0.0]
        inp.target_position = [distance]
        inp.target_velocity = [0.0]
        inp.target_acceleration = [0.0]
        inp.max_velocity = [_L_MAX_VEL]
        inp.max_acceleration = [_L_MAX_ACC]
        inp.max_jerk = [_L_MAX_JERK]

        current_angles = list(start_angles)
        first_result = otg.update(inp, out)
        est_duration = out.trajectory.duration
        t_start = time.time()

        self.log(
            "info",
            f"MoveL Ruckig | dist={distance * 100:.1f}cm | 예상 {est_duration:.1f}s",
        )

        def _step(s_meters: float) -> bool:
            nonlocal current_angles
            ratio = s_meters / distance
            waypoint = (start + ratio * (end - start)).tolist()
            result = self._motion.move_tcp(waypoint, current_angles)
            if result is None:
                logger.warning(
                    f"MoveL IK 실패 | s={s_meters * 100:.1f}cm "
                    f"| waypoint={[f'{v:.4f}' for v in waypoint]}"
                )
                return False
            current_angles = result
            self._publish_cmd(result)
            return True

        try:
            # 첫 번째 step
            if not _step(out.new_position[0]):
                self._publish_traj_state("failed", 0.0)
                return
            elapsed = time.time() - t_start
            progress = min(elapsed / est_duration, 1.0) if est_duration > 0 else 1.0
            self._publish_traj_state("running", progress)

            if first_result == Result.Finished:
                self._publish_traj_state("done", 1.0)
                self.log("info", "MoveL 완료 (즉시)")
                return

            inp.current_position = list(out.new_position)
            inp.current_velocity = list(out.new_velocity)
            inp.current_acceleration = list(out.new_acceleration)

            while True:
                if self._traj_stop.is_set():
                    self._publish_traj_state("stopped", progress)
                    return

                next_t = t_start + (time.time() - t_start) + TRAJ_DT
                result = otg.update(inp, out)

                if not _step(out.new_position[0]):
                    self._publish_traj_state("failed", progress)
                    return

                elapsed = time.time() - t_start
                progress = min(elapsed / est_duration, 1.0) if est_duration > 0 else 1.0
                self._publish_traj_state("running", progress)

                if result == Result.Finished:
                    self._publish_traj_state("done", 1.0)
                    self.log("info", f"MoveL 완료 ({elapsed * 1000:.0f}ms)")
                    return

                if result == Result.Error:
                    logger.error("MoveL Ruckig 오류")
                    self._publish_traj_state("failed", progress)
                    return

                inp.current_position = list(out.new_position)
                inp.current_velocity = list(out.new_velocity)
                inp.current_acceleration = list(out.new_acceleration)

                sleep_time = next_t - time.time()
                if sleep_time > 0:
                    time.sleep(sleep_time)

        finally:
            ok = self._set_arm_profile(
                velocity=_DEFAULT_PROFILE_VEL,
                acceleration=_DEFAULT_PROFILE_ACC,
            )
            if not ok:
                logger.warning("MoveL: profile 복원 실패")
