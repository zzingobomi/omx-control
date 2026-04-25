import numpy as np

intrinsic = np.load("robot/calibration/intrinsic.npz")
hand_eye = np.load("robot/calibration/hand_eye.npz")

print("=== Intrinsic ===")
for k in intrinsic.files:
    print(f"\n[{k}]")
    print(intrinsic[k])

print("\n=== Hand-Eye ===")
for k in hand_eye.files:
    print(f"\n[{k}]")
    print(hand_eye[k])
