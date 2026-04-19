import logging
import numpy as np
from pathlib import Path

from core.base_node import BaseNode
from core.topic_map import Service
from modules.camera.capture import CameraCapture
from modules.calibration.intrinsic import IntrinsicCalibration
from modules.calibration.hand_eye import HandEyeCalibration
from modules.calibration.pose_estimator import PoseEstimator

logger = logging.getLogger(__name__)

SAVE_DIR = Path(__file__).parents[2] / "robot" / "calibration"


class CalibrationNode(BaseNode):
    def __init__(self, camera: CameraCapture):
        super().__init__("calibration_node")

        self.camera = camera
        self.intrinsic = IntrinsicCalibration()
        self.hand_eye = HandEyeCalibration()
        self.pose_estimator = PoseEstimator()

        # 내부 캘리브레이션
        self.create_service(Service.CALIB_CAPTURE,
                            self._srv_capture)
        self.create_service(Service.CALIB_INTRINSIC_START,
                            self._srv_intrinsic_start)
        self.create_service(Service.CALIB_INTRINSIC_SAVE,
                            self._srv_intrinsic_save)

        # Hand-Eye 캘리브레이션
        self.create_service(Service.CALIB_HANDEYE_START,
                            self._srv_handeye_start)
        self.create_service(Service.CALIB_HANDEYE_SAVE,
                            self._srv_handeye_save)

    # ─── 이미지 캡처 ─────────────────────────────────────────

    def _srv_capture(self, req: dict) -> dict:
        pass

    # ─── 내부 캘리브레이션 ────────────────────────────────────

    def _srv_intrinsic_start(self, req: dict) -> dict:
        pass

    def _srv_intrinsic_save(self, req: dict) -> dict:
        pass

    # ─── Hand-Eye 캘리브레이션 ────────────────────────────────

    def _srv_handeye_start(self, req: dict) -> dict:
        pass

    def _srv_handeye_save(self, req: dict) -> dict:
        pass
