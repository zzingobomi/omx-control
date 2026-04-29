from modules.task.step_types import (
    DetectStep,
    GripperStep,
    HomeStep,
    MoveTCPStep,
    Task,
    WaitStep,
)
from modules.kinematics.solver import Position3

PRE_GRASP_Z = 0.06  # 오브젝트 위 6cm
GRASP_Z = 0.010  # 오브젝트 위 1cm
LIFT_Z = 0.08  # 파지 후 들어올리는 높이


def create_pick_and_place_task(
    place_position: Position3,
) -> Task:
    return Task(
        name="pick_and_place",
        description=(
            f"물체를 집어 ({place_position[0]:.3f}, "
            f"{place_position[1]:.3f}, {place_position[2]:.3f})에 내려놓기"
        ),
        steps=[
            GripperStep(action="open", label="open_gripper"),
            # HomeStep(label="go_home"),
            # DetectStep(
            #     output_key="object_pos",
            #     label="detect_object",
            # ),
            # MoveTCPStep(
            #     position_key="object_pos",
            #     offset=(0.0, 0.0, PRE_GRASP_Z),
            #     label="pre_grasp",
            # ),
            # MoveTCPStep(
            #     position_key="object_pos",
            #     offset=(0.0, 0.0, GRASP_Z),
            #     label="grasp",
            # ),
            # GripperStep(action="close", label="close_gripper"),
            # WaitStep(duration_sec=0.5, label="grip_settle"),
            # MoveTCPStep(
            #     position_key="object_pos",
            #     offset=(0.0, 0.0, LIFT_Z),
            #     label="lift",
            # ),
            # MoveTCPStep(
            #     position=place_position,
            #     label="move_to_place",
            # ),
            # GripperStep(action="open", label="release"),
            # WaitStep(duration_sec=0.3, label="release_settle"),
            # HomeStep(label="return_home"),
        ],
    )
