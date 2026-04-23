import time
import json
import math
import cv2
import numpy as np
import zenoh
from core.topic_map import Topic, Service

PUBLISH_HZ = 20
MOTOR_IDS = [(1, "joint1"), (2, "joint2"), (3, "joint3"),
             (4, "joint4"), (5, "joint5"), (6, "gripper")]

cmd_positions = {mid: 2048 for mid, _ in MOTOR_IDS}
actual_positions = {mid: 2048.0 for mid, _ in MOTOR_IDS}
FOLLOW_SPEED = 0.05

LOG_LEVELS = ["info", "warning", "error"]
MOCK_NODES = ["motor_node", "camera_node"]


# ─── 가짜 프레임 ─────────────────────────────────────────────

def make_fake_frame(t: float) -> bytes:
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    frame[:] = (
        int(40 + 20 * math.sin(t)),
        int(40 + 20 * math.sin(t + 2)),
        int(40 + 20 * math.sin(t + 4)),
    )
    cv2.putText(frame, "MOCK CAMERA",   (20,  50),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(frame, f"t={t:.2f}",    (20, 100),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (180, 180, 180), 1)
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()


# ─── Zenoh 핸들러 ────────────────────────────────────────────

def on_cmd_joint(sample):
    data = json.loads(sample.payload.to_bytes())
    for j in data.get("joints", []):
        if "id" in j and "position" in j:
            cmd_positions[j["id"]] = j["position"]
            print(f"[mock] CMD 수신: joint{j['id']} → {j['position']}")


def on_enable(query):
    data = json.loads(query.payload.to_bytes()) if query.payload else {}
    enable = data.get("data", {}).get("enable", True)
    print(f"[mock] MOTOR_ENABLE: enable={enable}")
    query.reply(
        query.key_expr,
        json.dumps({"success": True, "message": "ok",
                   "data": {"enable": enable}})
    )


def on_get_config(query):
    configs = [
        {"id": mid, "name": name, "model": "XL430-W250", "mode": "position",
         "home": 2048, "limit": {"min": 0, "max": 4095}}
        for mid, name in MOTOR_IDS
    ]
    query.reply(
        query.key_expr,
        json.dumps({"success": True, "message": "ok",
                   "data": {"motors": configs}})
    )


# ─── 메인 ────────────────────────────────────────────────────

def main():
    session = zenoh.open(zenoh.Config())

    pub_state = session.declare_publisher(Topic.MOTOR_STATE_JOINT)
    pub_heartbeat = session.declare_publisher(Topic.SYSTEM_HEARTBEAT)
    pub_log = session.declare_publisher(Topic.SYSTEM_LOG)
    pub_camera_status = session.declare_publisher(Topic.CAMERA_STATE_STATUS)

    session.declare_subscriber(Topic.MOTOR_CMD_JOINT, on_cmd_joint)
    session.declare_queryable(Service.MOTOR_ENABLE,    on_enable)
    session.declare_queryable(Service.MOTOR_GET_CONFIG, on_get_config)

    print("[mock] 시작 — Ctrl+C로 종료")

    interval = 1.0 / PUBLISH_HZ
    last_heartbeat = 0.0
    last_log = 0.0
    log_index = 0
    camera_status_sent = False

    try:
        while True:
            t = time.time()

            # ─── 모터 상태 (20Hz) ────────────────────────────
            for mid, _ in MOTOR_IDS:
                actual_positions[mid] += (cmd_positions[mid] -
                                          actual_positions[mid]) * FOLLOW_SPEED

            joints = [
                {
                    "id": mid, "name": name,
                    "position": round(actual_positions[mid]),
                    "degree":   round((actual_positions[mid] / 4095) * 360, 2),
                    "velocity": 0.0, "torque": 0.0,
                }
                for mid, name in MOTOR_IDS
            ]
            pub_state.put(json.dumps({"timestamp": t, "joints": joints}))

            # ─── 카메라 프레임 (20Hz, 실제는 30fps지만 mock은 20으로) ──
            # session.put(Topic.CAMERA_STREAM_RAW, make_fake_frame(t))

            # ─── 카메라 상태 (최초 한 번) ────────────────────
            # if not camera_status_sent:
            #     pub_camera_status.put(json.dumps({
            #         "timestamp": t,
            #         "connected": True,
            #         "width":     1280,
            #         "height":    720,
            #         "fps":       30,
            #     }))
            #     camera_status_sent = True

            # ─── Heartbeat (1Hz) ─────────────────────────────
            # if t - last_heartbeat >= 1.0:
            #     for node in MOCK_NODES:
            #         pub_heartbeat.put(json.dumps({
            #             "node":      node,
            #             "status":    "ok",
            #             "timestamp": t,
            #         }))
            #     last_heartbeat = t

            # ─── 로그 (3초마다) ──────────────────────────────
            # if t - last_log >= 3.0:
            #     level = LOG_LEVELS[log_index % len(LOG_LEVELS)]
            #     node = MOCK_NODES[log_index % len(MOCK_NODES)]
            #     pub_log.put(json.dumps({
            #         "timestamp": t,
            #         "node":      node,
            #         "level":     level,
            #         "message":   f"[mock] 테스트 로그 #{log_index} ({level})",
            #     }))
            #     log_index += 1
            #     last_log = t

            time.sleep(interval)

    except KeyboardInterrupt:
        print("\n[mock] 종료")
    finally:
        session.close()


if __name__ == "__main__":
    main()
