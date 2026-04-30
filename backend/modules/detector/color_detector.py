import cv2
import numpy as np

from .base_detector import BaseDetector

# HSV 색상 범위 — 실제 물체에 맞게 조정
HSV_LOWER = (35, 100, 100)  # 초록색 계열 하한
HSV_UPPER = (85, 255, 255)  # 초록색 계열 상한
MIN_AREA_PX = 500  # 최소 blob 면적 (px²)


class ColorDetector(BaseDetector):
    def __init__(
        self,
        hsv_lower: tuple[int, int, int] = HSV_LOWER,
        hsv_upper: tuple[int, int, int] = HSV_UPPER,
        min_area: int = MIN_AREA_PX,
    ) -> None:
        self._lower = np.array(hsv_lower, dtype=np.uint8)
        self._upper = np.array(hsv_upper, dtype=np.uint8)
        self._min_area = min_area
        self._kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    def detect(self, frame: np.ndarray) -> tuple[float, float] | None:
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self._lower, self._upper)

        # 노이즈 제거
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, self._kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < self._min_area:
            return None

        M = cv2.moments(largest)
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]
        return (cx, cy)
