import math
from dataclasses import dataclass

from .solver import PybulletSolver, Position3, Quaternion


@dataclass
class TCPPose:
    position: Position3
    quaternion: Quaternion


@dataclass
class OrbitState:
    orbit_center: Position3
    current_quaternion: Quaternion
    active: bool = False


class MotionModes:
    def __init__(self) -> None:
        self._solver = PybulletSolver()
        self._orbit: OrbitState | None = None

    # ─── FK ────────────────────────────────────────────────────

    def get_tcp_pose(self, joint_angles: list[float]) -> TCPPose:
        position, quaternion = self._solver.fk(joint_angles)
        return TCPPose(position=position, quaternion=quaternion)

    # ─── Move TCP ─────────────────────────────────────────────────

    def move_tcp(
        self,
        target_position: Position3,
        current_joint_angles: list[float],
    ) -> list[float] | None:
        """
        TCP를 target_position으로 이동하는 관절 각도 반환.
        5-DOF arm이라 orientation 제약 없이 position only IK.
        반환: 관절 각도 (라디안), IK 실패 시 None.
        """
        return self._solver.ik(target_position, None, current_joint_angles)

    # ─── Orbit ─────────────────────────────────────────────────

    def orbit_set(self, current_joint_angles: list[float]) -> TCPPose:
        """
        TODO: 현재 버그 있음 (사용 X)
        orbit center 설정.
        현재 TCP 바로 아래 Z=0 평면을 체커보드 위치로 근사.
        체커보드가 바닥(Z=0)에 있고 TCP가 위에서 내려다보는 상황에 적합.
        """
        tcp_pos, tcp_quat = self._solver.fk(current_joint_angles)

        # orbit center = 현재 TCP의 XY 위치, Z=0 (바닥)
        orbit_center: Position3 = (tcp_pos[0], tcp_pos[1], 0.0)

        self._orbit = OrbitState(
            orbit_center=orbit_center,
            current_quaternion=tcp_quat,
            active=True,
        )
        return TCPPose(position=tcp_pos, quaternion=tcp_quat)

    def orbit_clear(self) -> None:
        self._orbit = None

    def orbit_rotate(
        self,
        delta_elevation: float,
        delta_azimuth: float,
        current_joint_angles: list[float],
    ) -> list[float] | None:
        """
        TODO: 현재 버그 있음 (사용 X)
        구면 좌표계로 TCP를 orbit center 주변에서 이동.
        delta_elevation: 위(+) / 아래(-) 라디안
        delta_azimuth:   오른쪽(+) / 왼쪽(-) 라디안
        r(거리)는 고정, elevation/azimuth만 변경.
        """
        if self._orbit is None or not self._orbit.active:
            return None

        current_tcp, _ = self._solver.fk(current_joint_angles)
        center = self._orbit.orbit_center

        dx = current_tcp[0] - center[0]
        dy = current_tcp[1] - center[1]
        dz = current_tcp[2] - center[2]

        r = math.sqrt(dx**2 + dy**2 + dz**2)
        if r < 1e-4:
            return None

        # 현재 구면 좌표
        elevation = math.asin(max(-1.0, min(1.0, dz / r)))
        azimuth = math.atan2(dy, dx)

        # delta 적용 (elevation은 5°~85° 범위 제한)
        new_elevation = max(math.radians(5), min(
            math.radians(85), elevation + delta_elevation))
        new_azimuth = azimuth + delta_azimuth

        # 구면 → 직교 좌표
        new_tcp: Position3 = (
            center[0] + r * math.cos(new_elevation) * math.cos(new_azimuth),
            center[1] + r * math.cos(new_elevation) * math.sin(new_azimuth),
            center[2] + r * math.sin(new_elevation),
        )

        return self._solver.ik(new_tcp, None, current_joint_angles)

    @property
    def orbit_active(self) -> bool:
        return self._orbit is not None and self._orbit.active

    @property
    def orbit_center(self) -> Position3 | None:
        return self._orbit.orbit_center if self._orbit else None
