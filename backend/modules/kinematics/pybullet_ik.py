import threading
from pathlib import Path
from typing import Optional
import numpy as np
import pybullet as p

# URDF 경로
URDF_PATH = Path(__file__).parents[3] / \
    "robot" / "urdf" / "omx_f" / "omx_f.urdf"


class PybulletIK:
    _instance: Optional["PybulletIK"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "PybulletIK":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True
        self._sim_lock = threading.Lock()

        self._client = p.connect(p.DIRECT)
        p.setGravity(0, 0, -9.81, physicsClientId=self._client)

        self._robot = p.loadURDF(
            str(URDF_PATH),
            useFixedBase=True,
            physicsClientId=self._client,
        )

        print(f"PyBullet IK initialized with robot ID: {self._robot}")
