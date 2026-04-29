from fastapi import APIRouter
from fastapi.responses import JSONResponse

from modules.calibration.loader import load_calibration, to_json

calibration_router = APIRouter(prefix="/calibration", tags=["calibration"])


@calibration_router.get("/results")
async def get_calibration_results():
    """
    Returns available calibration data as JSON.

    Response shape:
    {
        "intrinsic": {
            "camera_matrix": [[...], [...], [...]],
            "dist_coeffs": [[...]],
            "image_size": [w, h]
        },
        "hand_eye": {
            "R": [[...], [...], [...]],
            "t": [[...], [...], [...]]
        }
    }
    Fields are omitted if the corresponding .npz file does not exist.
    """
    data = load_calibration()
    if not data.is_ready():
        return JSONResponse(
            content={"error": "Calibration data is not ready"}, status_code=400
        )
    return JSONResponse(content=to_json(data))


# TODO: 프론트에서도 해당 api 없애기
# @calibration_router.get("/status")
# async def get_calibration_status():
#     return {
#         "intrinsic": (CALIB_DIR / "intrinsic.npz").exists(),
#         "hand_eye": (CALIB_DIR / "hand_eye.npz").exists(),
#     }
