import pygame

# ─── 매핑 상수 ─────────────────────────────────────────────
AXIS_LEFT_X = 0
AXIS_LEFT_Y = 1
AXIS_LT = 2
AXIS_RIGHT_X = 3
AXIS_RIGHT_Y = 4
AXIS_RT = 5

HAT_INDEX = 0
DEADZONE = 0.12
AXIS_EPS = 0.05  # 변화 감지 threshold


def apply_deadzone(v, dz=DEADZONE):
    return 0.0 if abs(v) < dz else v


pygame.init()
pygame.joystick.init()

joy = pygame.joystick.Joystick(0)
joy.init()

print(f"연결: {joy.get_name()}")
print("=== 조작해보면서 변화만 출력됨 ===")

prev_buttons = [0] * joy.get_numbuttons()
prev_axes = [0.0] * joy.get_numaxes()
prev_hat = (0, 0)

clock = pygame.time.Clock()

while True:
    for _ in pygame.event.get():
        pass

    # ─── 버튼 ─────────────────────────
    cur_buttons = [joy.get_button(i) for i in range(joy.get_numbuttons())]
    for i, (p, c) in enumerate(zip(prev_buttons, cur_buttons)):
        if p != c:
            print(f"[BTN {i}] {'DOWN' if c else 'UP'}")
    prev_buttons = cur_buttons

    # ─── 축 ───────────────────────────
    cur_axes = [apply_deadzone(joy.get_axis(i))
                for i in range(joy.get_numaxes())]

    for i, (p, c) in enumerate(zip(prev_axes, cur_axes)):
        if abs(p - c) > AXIS_EPS:
            print(f"[AXIS {i}] {c:+.2f}")
    prev_axes = cur_axes

    # ─── D-Pad ────────────────────────
    hat = joy.get_hat(HAT_INDEX)
    if hat != prev_hat:
        print(f"[DPAD] {hat}")
        prev_hat = hat

    clock.tick(60)
