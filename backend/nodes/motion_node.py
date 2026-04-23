import logging

from core.base_node import BaseNode
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
