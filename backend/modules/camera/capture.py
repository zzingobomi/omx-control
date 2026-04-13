import cv2
import logging
import threading

logger = logging.getLogger(__name__)


class CameraCapture:
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap: cv2.VideoCapture | None = None
        self._lock = threading.Lock()

    def open(self) -> bool:
        self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap.isOpened():
            logger.error(f"카메라를 열 수 없습니다: index={self.camera_index}")
            return False
        # 기본 해상도 설정
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        logger.info(f"카메라 연결 성공: index={self.camera_index}")
        return True

    def close(self) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
            logger.info("카메라 연결 종료")

    def read(self):
        if self.cap is None:
            return False, None
        with self._lock:
            ret, frame = self.cap.read()
        return ret, frame if ret else None

    @property
    def is_opened(self) -> bool:
        return self.cap is not None and self.cap.isOpened()

    @property
    def width(self) -> int:
        return int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) if self.cap else 0

    @property
    def height(self) -> int:
        return int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) if self.cap else 0

    @property
    def fps(self) -> float:
        return self.cap.get(cv2.CAP_PROP_FPS) if self.cap else 0.0
