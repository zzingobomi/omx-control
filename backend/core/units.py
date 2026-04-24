import math

# Dynamixel raw 중심값 (0°)
RAW_CENTER = 2048
RAW_MAX = 4095


def raw_to_degree(raw: int) -> float:
    return round((raw - RAW_CENTER) / RAW_MAX * 360.0, 2)


def degree_to_raw(degree: float) -> int:
    return int(degree / 360.0 * RAW_MAX + RAW_CENTER)


def raw_to_radian(raw: int, *, reverse: bool = False) -> float:
    angle = (raw - RAW_CENTER) / RAW_MAX * 2.0 * math.pi
    return -angle if reverse else angle


def radian_to_raw(
    radian: float,
    *,
    reverse: bool = False,
    min_raw: int = 0,
    max_raw: int = RAW_MAX,
) -> int:
    if reverse:
        radian = -radian
    raw = int(radian / (2.0 * math.pi) * RAW_MAX + RAW_CENTER)
    return max(min_raw, min(max_raw, raw))
