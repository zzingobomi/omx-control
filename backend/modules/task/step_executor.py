import logging
import threading
from typing import TYPE_CHECKING

from core.types import TrajStatus
from core.topic_map import Topic
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
        pass

    def _gripper(self, step: GripperStep) -> bool:
        pass

    def _detect(self, step: DetectStep, context: TaskContext) -> bool:
        pass

    def _wait(self, step: WaitStep) -> bool:
        pass

    def _home(self, step: HomeStep) -> bool:
        pass

    # ─── 내부 유틸 ─────────────────────────────────────────────────

    def _on_traj_state(self, data: dict) -> None:
        pass

    def _wait_for_traj(self, timeout: float = TRAJ_WAIT_TIMEOUT) -> bool:
        pass
