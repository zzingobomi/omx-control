import cv2
import numpy as np
import logging
from pathlib import Path
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class HandEyeResult:
    R_cam2gripper: np.ndarray  # 회전 행렬 (카메라 → 그리퍼)
    t_cam2gripper: np.ndarray  # 이동 벡터
    method: str


@dataclass
class Pose:
    R_gripper2base: np.ndarray  # 로봇 FK에서 얻은 회전 행렬
    t_gripper2base: np.ndarray  # 로봇 FK에서 얻은 이동 벡터
    R_target2cam: np.ndarray  # 체커보드 → 카메라 회전
    t_target2cam: np.ndarray  # 체커보드 → 카메라 이동


class HandEyeCalibration:
    def __init__(self):
        self.poses: list[Pose] = []
        self.result: HandEyeResult | None = None

    def add_pose(self, pose: Pose) -> None:
        self.poses.append(pose)
        logger.info(f"포즈 추가됨 ({len(self.poses)}개)")

    def calibrate(self, method: int = cv2.CALIB_HAND_EYE_TSAI) -> HandEyeResult | None:
        if len(self.poses) < 3:
            logger.warning(f"포즈 부족: {len(self.poses)}개 (최소 3개 필요)")
            return None

        R_gripper2base = [p.R_gripper2base for p in self.poses]
        t_gripper2base = [p.t_gripper2base for p in self.poses]
        R_target2cam = [p.R_target2cam for p in self.poses]
        t_target2cam = [p.t_target2cam for p in self.poses]

        R, t = cv2.calibrateHandEye(
            R_gripper2base,
            t_gripper2base,
            R_target2cam,
            t_target2cam,
            method=method,
        )

        method_name = {
            cv2.CALIB_HAND_EYE_TSAI: "TSAI",
            cv2.CALIB_HAND_EYE_PARK: "PARK",
            cv2.CALIB_HAND_EYE_HORAUD: "HORAUD",
            cv2.CALIB_HAND_EYE_ANDREFF: "ANDREFF",
            cv2.CALIB_HAND_EYE_DANIILIDIS: "DANIILIDIS",
        }.get(method, "UNKNOWN")

        self.result = HandEyeResult(
            R_cam2gripper=R,
            t_cam2gripper=t,
            method=method_name,
        )
        logger.info(f"Hand-Eye 캘리브레이션 완료 (method={method_name})")
        return self.result

    def save(self, path: str | Path) -> bool:
        if self.result is None:
            logger.warning("저장할 Hand-Eye 결과가 없습니다")
            return False

        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(
            str(path),
            R_cam2gripper=self.result.R_cam2gripper,
            t_cam2gripper=self.result.t_cam2gripper,
            method=self.result.method,
        )
        logger.info(f"Hand-Eye 결과 저장: {path}")
        return True

    def load(self, path: str | Path) -> HandEyeResult | None:
        path = Path(path)
        if not path.exists():
            return None

        data = np.load(str(path), allow_pickle=True)
        self.result = HandEyeResult(
            R_cam2gripper=data["R_cam2gripper"],
            t_cam2gripper=data["t_cam2gripper"],
            method=str(data["method"]),
        )
        return self.result

    def reset(self) -> None:
        self.poses.clear()
        self.result = None
