from pathlib import Path
import numpy as np
from fastapi import APIRouter
from fastapi.responses import JSONResponse

calibration_router = APIRouter(prefix="/calibration", tags=["calibration"])

CALIB_DIR = Path(__file__).parents[2] / "robot" / "calibration"


def _npz_to_json(path: Path, keys: list[str]) -> dict:
    data = np.load(path)
    return {k: data[k].tolist() for k in keys if k in data}


@calibration_router.get("/results")
async def get_calibration_results():
    """
    Returns available calibration data as JSON.

    Response shape:
    {
        "intrinsic": {
            "camera_matrix": [[...], [...], [...]],   // 3x3
            "dist_coeffs": [[...]]                    // 1xN
            "image_size": [w, h]                      // optional
        },
        "hand_eye": {
            "R": [[...], [...], [...]],               // 3x3 rotation
            "t": [[...], [...], [...]]                // 3x1 translation (meters)
        }
    }
    Fields are omitted if the corresponding .npz file does not exist.
    """
    result: dict = {}

    intrinsic_path = CALIB_DIR / "intrinsic.npz"
    if intrinsic_path.exists():
        try:
            data = np.load(intrinsic_path)
            intrinsic: dict = {}
            if "camera_matrix" in data:
                intrinsic["camera_matrix"] = data["camera_matrix"].tolist()
            if "dist_coeffs" in data:
                intrinsic["dist_coeffs"] = data["dist_coeffs"].tolist()
            if "image_size" in data:
                intrinsic["image_size"] = data["image_size"].tolist()
            result["intrinsic"] = intrinsic
        except Exception as e:
            result["intrinsic_error"] = str(e)

    hand_eye_path = CALIB_DIR / "hand_eye.npz"
    if hand_eye_path.exists():
        try:
            data = np.load(hand_eye_path)
            hand_eye: dict = {}
            r_key = next(
                (k for k in data.files if k.upper().startswith("R")), None)
            t_key = next(
                (k for k in data.files if k.upper().startswith("T")), None)
            if r_key:
                hand_eye["R"] = data[r_key].tolist()
            if t_key:
                hand_eye["t"] = data[t_key].tolist()
            hand_eye["available_keys"] = list(data.files)
            result["hand_eye"] = hand_eye
        except Exception as e:
            result["hand_eye_error"] = str(e)

    return JSONResponse(content=result)


@calibration_router.get("/status")
async def get_calibration_status():
    return {
        "intrinsic": (CALIB_DIR / "intrinsic.npz").exists(),
        "hand_eye": (CALIB_DIR / "hand_eye.npz").exists(),
    }
