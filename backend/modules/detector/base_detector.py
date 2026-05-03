from abc import ABC, abstractmethod
import numpy as np


class BaseDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray) -> tuple[float, float] | None: ...

    @abstractmethod
    def raw_detect(self, frame: np.ndarray) -> list[dict]: ...
