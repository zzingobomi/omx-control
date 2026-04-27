import math
import time
import logging
import threading

from core.base_node import BaseNode
from core.topic_map import Topic, Service
from core.units import RAW_MAX, raw_to_deg
from modules.dynamixel.driver import DynamixelDriver
from modules.dynamixel.motor_config import load_motor_config

logger = logging.getLogger(__name__)

STATE_PUBLISH_HZ = 20  # 초당 상태 발행 횟수

# ─── Dynamixel 프로파일 단위 상수 ────────────────────────────
_PROFILE_VEL_UNIT = 0.229  # rpm per count
_PROFILE_ACC_UNIT = 214.577  # rev/min² per count

# Trapezoidal profile 비율 (가속:등속:감속 = 25:50:25)
_ACCEL_RATIO = 0.25
_DECEL_RATIO = 0.25
_CRUISE_RATIO = 1.0 - _ACCEL_RATIO - _DECEL_RATIO  # 0.50


class MotorNode(BaseNode):
    def __init__(self):
        super().__init__("motor_node")

        port_cfg, motors = load_motor_config()
        self.port = port_cfg.get()
        self.motor_cfgs = motors
        self.driver = DynamixelDriver(self.port, motors)
        self.connected = False
        self.torque_enabled = False

        self.create_subscriber(Topic.MOTOR_CMD_JOINT, self._on_cmd_joint)
        self.create_service(Service.MOTOR_ENABLE, self._srv_enable)
        self.create_service(Service.MOTOR_REBOOT, self._srv_reboot)
        self.create_service(Service.MOTOR_SET_PROFILE, self._srv_set_profile)
        self.create_service(Service.MOTOR_SET_PROFILE_ALL, self._srv_set_profile_all)
        self.create_service(Service.MOTOR_GET_CONFIG, self._srv_get_config)
        self.create_service(Service.MOTOR_MOVE_J, self._srv_move_j)

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

    # ─── Publishers ──────────────────────────────────────────

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
                        "degree": raw_to_deg(raw),
                        "velocity": 0.0,
                        "torque": 0.0,
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

    # ─── Subscribers ─────────────────────────────────────────

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

    # ─── Services ────────────────────────────────────────────

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

    def _srv_set_profile_all(self, req: dict) -> dict:
        data = req.get("data", {})
        target_ids = data.get("ids", self.driver.motor_ids)
        velocity = int(data.get("velocity", 0))
        acceleration = int(data.get("acceleration", 0))

        try:
            vel_map = {mid: velocity for mid in target_ids}
            acc_map = {mid: acceleration for mid in target_ids}
            self.driver.set_profile_accelerations_sync(acc_map)
            self.driver.set_profile_velocities_sync(vel_map)
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

    def _srv_move_j(self, req: dict) -> dict:
        """
        MoveJ (profile-based joint motion)

        - joint target position 이동 (trajectory 생성 없음)
        - displacement 기반으로 velocity / accel만 계산
        - Dynamixel 내부 trapezoidal profile에 의존

        flow:
        current vs target → distance → peak v/a → motor unit → goal position

        특징:
        - joint independent, no coupling
        - no external trajectory planning (motor executes profile)
        - limited to firmware motion quality

        개선:
        - Ruckig: external trajectory + jerk control + realtime replanning
        """
        if not self.connected:
            return {"success": False, "message": "모터 미연결", "data": {}}

        data = req.get("data", {})
        target_joints = data.get("joints", [])
        duration_sec = float(data.get("duration", 3.0))
        duration_sec = max(0.5, min(30.0, duration_sec))

        if not target_joints:
            return {"success": False, "message": "joints 필요", "data": {}}

        try:
            current_positions = self.driver.get_present_positions()
            velocities: dict[int, int] = {}
            accelerations: dict[int, int] = {}

            for j in target_joints:
                mid = int(j["id"])
                target_raw = int(j["position"])
                current_raw = current_positions.get(mid, target_raw)

                displacement_raw = abs(target_raw - current_raw)
                displacement_rad = displacement_raw / RAW_MAX * 2.0 * math.pi

                if displacement_rad < 1e-4:
                    velocities[mid] = 0
                    accelerations[mid] = 0
                    continue

                # ── Trapezoidal peak velocity ─────────────────────────
                peak_vel_rad_s = (
                    displacement_rad
                    / (_CRUISE_RATIO + _ACCEL_RATIO / 2 + _DECEL_RATIO / 2)
                    / duration_sec
                )
                # rad/s → rpm
                peak_vel_rpm = peak_vel_rad_s * 60.0 / (2.0 * math.pi)
                vel_value = max(1, int(peak_vel_rpm / _PROFILE_VEL_UNIT))

                # ── Trapezoidal peak acceleration ─────────────────────
                peak_acc_rad_s2 = peak_vel_rad_s / (_ACCEL_RATIO * duration_sec)
                # rad/s² → rev/min²
                peak_acc_rpm2 = peak_acc_rad_s2 * (60.0**2) / (2.0 * math.pi)
                acc_value = max(1, int(peak_acc_rpm2 / _PROFILE_ACC_UNIT))

                velocities[mid] = vel_value
                accelerations[mid] = acc_value

            self.driver.set_profile_accelerations_sync(accelerations)
            self.driver.set_profile_velocities_sync(velocities)

            positions = {int(j["id"]): int(j["position"]) for j in target_joints}
            self.driver.set_goal_positions_sync(positions)

            self.log(
                "info",
                f"MoveJ 시작 | duration={duration_sec:.1f}s "
                f"| joints={list(positions.keys())}",
            )
            return {
                "success": True,
                "message": "ok",
                "data": {"duration": duration_sec},
            }

        except Exception as e:
            logger.error(f"MoveJ 오류: {e}")
            return {"success": False, "message": str(e), "data": {}}
