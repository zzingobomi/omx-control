import time
import logging
import threading

from core.base_node import BaseNode
from core.topic_map import Topic, Service
from core.units import raw_to_degree
from modules.dynamixel.driver import DynamixelDriver
from modules.dynamixel.motor_config import load_motor_config

logger = logging.getLogger(__name__)

STATE_PUBLISH_HZ = 20  # 초당 상태 발행 횟수


class MotorNode(BaseNode):
    def __init__(self):
        super().__init__("motor_node")

        port_cfg, motors = load_motor_config()
        self.port = port_cfg.get()
        self.motor_cfgs = motors
        self.driver = DynamixelDriver(self.port, motors)
        self.connected = False
        self.torque_enabled = False

        # subscriber / service 등록
        self.create_subscriber(Topic.MOTOR_CMD_JOINT, self._on_cmd_joint)
        self.create_service(Service.MOTOR_ENABLE, self._srv_enable)
        self.create_service(Service.MOTOR_REBOOT, self._srv_reboot)
        self.create_service(Service.MOTOR_SET_PROFILE, self._srv_set_profile)
        self.create_service(Service.MOTOR_GET_CONFIG, self._srv_get_config)

    # ─── Lifecycle ───────────────────────────────────────────

    def start(self) -> None:
        self.connected = self.driver.connect()
        if self.connected:
            self.driver.torque_enable_all()
            self.torque_enabled = True
            self.log("info", f"모터 노드 시작 ({self.port})")
        else:
            self.torque_enabled = False
            self.log("error", f"Dynamixel 연결 실패 ({self.port})")

        super().start()

        self._state_thread = threading.Thread(
            target=self._state_loop,
            name="motor-state",
            daemon=True,
        )
        self._state_thread.start()

    def stop(self) -> None:
        super().stop()
        if self.connected:
            self.driver.disconnect()

    # ─── Publishers (토픽 발행) ───────────────────────────

    def _state_loop(self) -> None:
        interval = 1.0 / STATE_PUBLISH_HZ
        while self._running:
            if self.connected:
                self._publish_state()
            time.sleep(interval)

    def _publish_state(self) -> None:
        try:
            positions = self.driver.get_present_positions()
            joints = []
            for cfg in self.motor_cfgs:
                raw = positions.get(cfg.id)
                if raw is None:
                    logger.warning(f"모터 {cfg.id}({cfg.name}) 위치 읽기 실패")
                    continue
                joints.append(
                    {
                        "id": cfg.id,
                        "name": cfg.name,
                        "position": raw,
                        "degree": raw_to_degree(raw),
                        "velocity": 0.0,  # TODO: 추후 SyncRead 확장 시 구현
                        "torque": 0.0,  # TODO: 추후 SyncRead 확장 시 구현
                    }
                )
            self.publish(
                Topic.MOTOR_STATE_JOINT,
                {
                    "timestamp": time.time(),
                    "joints": joints,
                },
            )
        except Exception as e:
            logger.error(f"상태 발행 오류: {e}")

    # ─── Subscribers (토픽 수신) ─────────────────────────

    def _on_cmd_joint(self, data: dict) -> None:
        if not self.connected:
            return
        try:
            joints = data.get("joints", [])
            positions = {
                j["id"]: int(j["position"])
                for j in joints
                if "id" in j and "position" in j
            }
            if positions:
                self.driver.set_goal_positions_sync(positions)
        except Exception as e:
            logger.error(f"joint 명령 처리 오류: {e}")

    # ─── Services (요청 처리 / 서버) ─────────────────────

    def _srv_enable(self, req: dict) -> dict:
        enable: bool = req.get("data", {}).get("enable", True)
        try:
            if enable:
                self.driver.torque_enable_all()
            else:
                self.driver.torque_disable_all()
            self.torque_enabled = enable
            self.log("info", f"토크 {'ON' if enable else 'OFF'}")
            return {"success": True, "message": "ok", "data": {"enable": enable}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_reboot(self, req: dict) -> dict:
        motor_id: int | None = req.get("data", {}).get("id")
        try:
            if motor_id:
                self.driver.reboot(motor_id)
            else:
                for mid in self.driver.motor_ids:
                    self.driver.reboot(mid)
            return {"success": True, "message": "ok", "data": {}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_set_profile(self, req: dict) -> dict:
        data = req.get("data", {})
        motor_id = data.get("id")
        velocity = data.get("velocity")
        acceleration = data.get("acceleration")
        try:
            if motor_id and velocity is not None:
                self.driver.set_profile_velocity(motor_id, int(velocity))
            if motor_id and acceleration is not None:
                self.driver.set_profile_acceleration(motor_id, int(acceleration))
            return {"success": True, "message": "ok", "data": {}}
        except Exception as e:
            return {"success": False, "message": str(e), "data": {}}

    def _srv_get_config(self, req: dict) -> dict:
        configs = [
            {
                "id": cfg.id,
                "name": cfg.name,
                "model": cfg.model,
                "mode": cfg.mode,
                "home": cfg.home,
                "limit": {"min": cfg.limit_min, "max": cfg.limit_max},
            }
            for cfg in self.motor_cfgs
        ]
        return {
            "success": True,
            "message": "ok",
            "data": {"motors": configs, "torque_enabled": self.torque_enabled},
        }

    # ─── Service Clients (요청 보내기) ──────────────────
