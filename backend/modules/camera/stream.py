import cv2
import numpy as np


def frame_to_jpeg_bytes(frame: np.ndarray, quality: int = 80) -> bytes:
    ret, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ret:
        raise RuntimeError("JPEG 인코딩 실패")
    return buf.tobytes()
