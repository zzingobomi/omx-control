import math
from dataclasses import dataclass
from typing import Optional

from .pybullet_ik import PybulletIK


@dataclass
class TCPPose:
    position: list[float]      # [x, y, z] 미터
    orientation: list[float]   # [x, y, z, w] quaternion


@dataclass
class PivotState:
    pivot_point: list[float]         # 고정 TCP 위치 [x, y, z]
    current_orientation: list[float]  # 현재 orientation quaternion
    active: bool = False


class MotionModes:

    PIVOT_STEP_RAD = math.radians(5)

    def __init__(self) -> None:
        self._ik = PybulletIK()
        self._pivot: Optional[PivotState] = None
