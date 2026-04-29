# core/types.py
from enum import Enum


class TrajStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    STOPPED = "stopped"
    FAILED = "failed"
