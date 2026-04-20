import cv2
import numpy as np
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PoseEstimateResult:
    R: np.ndarray
    t: np.ndarray
    rvec: np.ndarray


class PoseEstimator:
    def estimate(
        self,
        obj_points: np.ndarray,
        img_points: np.ndarray,
        camera_matrix: np.ndarray,
        dist_coeffs: np.ndarray,
    ) -> PoseEstimateResult | None:
        ok, rvec, tvec = cv2.solvePnP(
            obj_points,
            img_points,
            camera_matrix,
            dist_coeffs,
        )
        if not ok:
            logger.warning("solvePnP 풀이 실패")
            return None

        R, _ = cv2.Rodrigues(rvec)
        return PoseEstimateResult(R=R, t=tvec, rvec=rvec)
