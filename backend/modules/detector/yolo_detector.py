import numpy as np

from .base_detector import BaseDetector

# 감지할 COCO 클래스명 (yolov8 기준)
TARGET_CLASSES = {"cup", "bottle"}


class YoloDetector(BaseDetector):
    def __init__(self, model_path: str = "yolov8n.pt") -> None:
        from ultralytics import YOLO

        self._model = YOLO(model_path)

    def detect(self, frame: np.ndarray) -> tuple[float, float] | None:
        results = self._model(frame, verbose=False)
        boxes = results[0].boxes

        for box in boxes:
            cls_name = self._model.names[int(box.cls)]
            if cls_name not in TARGET_CLASSES:
                continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            return (cx, cy)

        return None
