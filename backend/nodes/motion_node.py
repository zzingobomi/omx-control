import logging
import threading

from core.base_node import BaseNode
from core.topic_map import Service, Topic
from core.units import radian_to_raw, raw_to_radian
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
        self._current_raw: dict[int, int] = {}
        self._state_lock = threading.Lock()

        # 현재 joint state 구독
        self.create_subscriber(Topic.MOTOR_STATE_JOINT, self._on_motor_state)

        # 서비스 등록
        self.create_service(Service.MOTION_GET_TCP, self._srv_get_tcp)
        self.create_service(Service.MOTION_MOVE_TCP, self._srv_move_tcp)
        self.create_service(Service.MOTION_PIVOT_SET, self._srv_pivot_set)
        self.create_service(Service.MOTION_PIVOT_ROTATE, self._srv_pivot_rotate)
        self.create_service(Service.MOTION_PIVOT_CLEAR, self._srv_pivot_clear)

    # ─── 단위 변환 ────────────────────────────────────────────

    def _get_current_joint_angles_rad(self) -> list[float] | None:
        with self._state_lock:
            if not self._current_raw:
                return None
            result = []
            for cfg in self._arm_cfgs:
                raw = self._current_raw.get(cfg.id)
                if raw is None:
                    return None
                result.append(raw_to_radian(raw, reverse=cfg.reverse))
            return result

    def _joint_angles_rad_to_cmd(self, angles_rad: list[float]) -> list[dict]:
        return [
            {
                "id": cfg.id,
                "position": radian_to_raw(
                    angle_rad,
                    reverse=cfg.reverse,
                    min_raw=cfg.limit_min,
                    max_raw=cfg.limit_max,
                ),
            }
            for cfg, angle_rad in zip(self._arm_cfgs, angles_rad)
        ]

    # ─── Subscriber ───────────────────────────────────────────

    def _on_motor_state(self, data: dict) -> None:
        joints = data.get("joints", [])
        with self._state_lock:
            for j in joints:
                self._current_raw[j["id"]] = j["position"]

    # ─── Services ─────────────────────────────────────────────

    def _srv_get_tcp(self, req: dict) -> dict:
        angles = self._get_current_joint_angles_rad()
        if angles is None:
            return {"success": False, "message": "관절 상태 수신 전", "data": {}}
        try:
            pass
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_move_tcp(self, req: dict) -> dict:
        try:
            pass
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_pivot_set(self, req: dict) -> dict:
        try:
            pass
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_pivot_rotate(self, req: dict) -> dict:
        try:
            pass
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_pivot_clear(self, req: dict) -> dict:
        self._motion.pivot_clear()
        self.log("info", "Pivot 모드 해제")
        return {"success": True, "message": "ok", "data": {}}
