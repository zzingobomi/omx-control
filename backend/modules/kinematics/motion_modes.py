import math
from dataclasses import dataclass
import pybullet as p

from .solver import PybulletSolver, Position3, Quaternion


@dataclass
class TCPPose:
    position: Position3
    quaternion: Quaternion


@dataclass
class PivotState:
    pivot_point: Position3
    current_quaternion: Quaternion
    active: bool = False


class MotionModes:
    PIVOT_STEP_RAD = math.radians(5)

    def __init__(self) -> None:
        self._solver = PybulletSolver()
        self._pivot: PivotState | None = None

    # ─── FK ────────────────────────────────────────────────────

    def get_tcp_pose(self, joint_angles: list[float]) -> TCPPose:
        position, quaternion = self._solver.fk(joint_angles)
        return TCPPose(position=position, quaternion=quaternion)

    # ─── Move TCP ───────────────────────────────────────────────

    def move_tcp(
        self,
        target_position: Position3,
        target_quaternion: Quaternion | None,
        current_joint_angles: list[float],
    ) -> list[float] | None:
        """
        TCP를 target_position / target_quaternion 으로 이동하는 관절 각도 반환.
        target_quaternion: None이면 현재 orientation 유지.
        moveL 처럼 waypoint 없이 목표 위치로 이동.
        반환: 관절 각도 (라디안), IK 실패 시 None.
        """
        if target_quaternion is None:
            _, current_quaternion = self._solver.fk(current_joint_angles)
            target_quaternion = current_quaternion

        return self._solver.ik(target_position, target_quaternion, current_joint_angles)

    # ─── Pivot ─────────────────────────────────────────────────

    def pivot_set(self, current_joint_angles: list[float]) -> TCPPose:
        position, quaternion = self._solver.fk(current_joint_angles)
        self._pivot = PivotState(
            pivot_point=position,
            current_quaternion=quaternion,
            active=True,
        )
        return TCPPose(position=position, quaternion=quaternion)

    def pivot_clear(self) -> None:
        self._pivot = None

    def pivot_rotate(
        self,
        delta_pitch: float,
        delta_yaw: float,
        current_joint_angles: list[float],
    ) -> list[float] | None:
        """
        Pivot point를 유지하면서 orientation 변경.
        delta_pitch / delta_yaw: 라디안
        반환: 새 관절 각도 (라디안), IK 실패 시 None.
        """
        if self._pivot is None or not self._pivot.active:
            return None

        delta_quaternion: Quaternion = p.getQuaternionFromEuler(
            [delta_pitch, 0.0, delta_yaw]
        )
        _, new_quaternion = p.multiplyTransforms(
            [0, 0, 0],  # posA
            self._pivot.current_quaternion,  # ornA
            [0, 0, 0],  # posB
            delta_quaternion,  # ornB
        )
        new_quaternion = tuple(new_quaternion)

        result = self._solver.ik(
            self._pivot.pivot_point,
            new_quaternion,
            current_joint_angles,
        )

        if result is not None:
            self._pivot.current_quaternion = new_quaternion

        return result

    @property
    def pivot_active(self) -> bool:
        return self._pivot is not None and self._pivot.active

    @property
    def pivot_point(self) -> Position3 | None:
        return self._pivot.pivot_point if self._pivot else None
