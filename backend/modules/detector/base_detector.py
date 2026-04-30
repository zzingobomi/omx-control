from abc import ABC, abstractmethod
import numpy as np


class BaseDetector(ABC):
    @abstractmethod
    def detect(self, frame: np.ndarray) -> tuple[float, float] | None: ...
