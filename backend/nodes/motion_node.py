import time
import logging

from core.base_node import BaseNode
from core.topic_map import Service, Topic
from core.joint_state_cache import JointStateCache
from core.units import deg_to_rad, rad_to_raw, raw_to_rad
from modules.dynamixel.motor_config import MotorConfig, load_motor_config
from modules.kinematics.motion_modes import MotionModes

logger = logging.getLogger(__name__)

# gripper(id=6)는 IK 대상에서 제외
GRIPPER_ID = 6


class MotionNode(BaseNode):
    def __init__(self):
        super().__init__("motion_node")

        _, self._motor_cfgs = load_motor_config()
        # gripper 제외한 arm joints만
        self._arm_cfgs: list[MotorConfig] = [
            m for m in self._motor_cfgs if m.id != GRIPPER_ID
        ]

        self._motion = MotionModes()
        self._cache = JointStateCache()
        self._cache.subscribe(self)

        # 서비스 등록
        self.create_service(Service.MOTION_GET_TCP, self._srv_get_tcp)
        self.create_service(Service.MOTION_MOVE_TCP, self._srv_move_tcp)
        self.create_service(Service.MOTION_ORBIT_SET, self._srv_orbit_set)
        self.create_service(Service.MOTION_ORBIT_ROTATE,
                            self._srv_orbit_rotate)
        self.create_service(Service.MOTION_ORBIT_CLEAR, self._srv_orbit_clear)

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
                "data": {
                    "position": pose.position,
                    "quaternion": pose.quaternion,
                },
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

            cmds = self._joint_angles_rad_to_cmd(result)
            self.publish(
                Topic.MOTOR_CMD_JOINT,
                {
                    "timestamp": time.time(),
                    "joints": cmds,
                },
            )
            return {"success": True, "message": "ok", "data": {"joints": cmds}}
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
                "data": {
                    "position": pose.position,
                    "quaternion": pose.quaternion,
                },
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
                    "message": "IK 수렴 실패 (관절 한계 도달)",
                    "data": {},
                }

            cmds = self._joint_angles_rad_to_cmd(result)
            self.publish(
                Topic.MOTOR_CMD_JOINT,
                {
                    "timestamp": time.time(),
                    "joints": cmds,
                },
            )
            return {"success": True, "message": "ok", "data": {"joints": cmds}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_orbit_clear(self, req: dict) -> dict:
        self._motion.orbit_clear()
        self.log("info", "Orbit 모드 해제")
        return {"success": True, "message": "ok", "data": {}}
