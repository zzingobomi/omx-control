from dataclasses import dataclass, field
from typing import Literal, Union

from modules.kinematics.solver import Position3


@dataclass
class MoveTCPStep:
    position: Position3 | None = None
    position_key: str | None = None
    offset: Position3 = (0.0, 0.0, 0.0)
    label: str = ""
    type: Literal["move_tcp"] = field(default="move_tcp", init=False, repr=False)


@dataclass
class GripperStep:
    action: Literal["open", "close"] = "open"
    label: str = ""
    type: Literal["gripper"] = field(default="gripper", init=False, repr=False)


@dataclass
class DetectStep:
    output_key: str = "detected_position"
    label: str = ""
    type: Literal["detect"] = field(default="detect", init=False, repr=False)


@dataclass
class WaitStep:
    duration_sec: float = 0.5
    label: str = ""
    type: Literal["wait"] = field(default="wait", init=False, repr=False)


@dataclass
class HomeStep:
    label: str = "go_home"
    type: Literal["home"] = field(default="home", init=False, repr=False)


Step = Union[
    MoveTCPStep,
    GripperStep,
    DetectStep,
    WaitStep,
    HomeStep,
]


@dataclass
class Task:
    name: str
    steps: list[Step]
    description: str = ""


@dataclass
class TaskContext:
    data: dict = field(default_factory=dict)

    def set(self, key: str, value: object) -> None:
        self.data[key] = value

    def get(self, key: str, default: object = None) -> object:
        return self.data.get(key, default)

    def has(self, key: str) -> bool:
        return key in self.data

    def clear(self) -> None:
        self.data.clear()
