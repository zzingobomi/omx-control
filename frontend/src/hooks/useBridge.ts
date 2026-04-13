import { useEffect } from "react";
import { bridge } from "@/api/bridge";
import { useSystemStore } from "@/store/systemStore";
import { ServiceKey, Topic } from "@/constants/topics";
import type { JointState, MotorConfig } from "@/types/motor";
import { useRobotStore } from "@/store/robotStore";
import type { CameraStatus } from "@/types/camera";
import { useCameraStore } from "@/store/cameraStore";

export function useBridge() {
  const setBridgeConnected = useSystemStore((s) => s.setBridgeConnected);
  const updateNode = useSystemStore((s) => s.updateNode);
  const addLog = useSystemStore((s) => s.addLog);
  const setJoints = useRobotStore((s) => s.setJoints);
  const setConfigs = useRobotStore((s) => s.setConfigs);
  const setTorque = useRobotStore((s) => s.setTorque);
  const setStatus = useCameraStore((s) => s.setStatus);

  useEffect(() => {
    // Bridge 연결
    bridge.connect((connected) => {
      setBridgeConnected(connected);
      if (connected) {
        // 연결되면 모터 설정 정보 요청
        bridge.callService(ServiceKey.MOTOR_GET_CONFIG, {}).then((res) => {
          if (res.success && res.data?.motors) {
            setConfigs(res.data.motors as MotorConfig[]);
            console.log(res.data);
            if (res.data.torque_enabled !== undefined) {
              setTorque(res.data.torque_enabled as boolean);
            }
          }
        });
      }
    });

    // Joint 상태 구독
    const unsubJoint = bridge.subscribe(Topic.MOTOR_STATE_JOINT, (data) => {
      const state = data as unknown as JointState;
      setJoints(state.joints ?? []);
    });

    // Heartbeat 구독
    const unsubHeartbeat = bridge.subscribe(Topic.SYSTEM_HEARTBEAT, (data) => {
      const { node, status, timestamp } = data as {
        node: string;
        status: string;
        timestamp: number;
      };
      updateNode(node, status === "ok" ? "running" : "error", timestamp);
    });

    // 로그 구독
    const unsubLog = bridge.subscribe(Topic.SYSTEM_LOG, (data) => {
      addLog(
        data as {
          timestamp: number;
          node: string;
          level: string;
          message: string;
        }
      );
    });

    // 카메라 상태 구독
    const unsubCameraStatus = bridge.subscribe(
      Topic.CAMERA_STATE_STATUS,
      (data) => {
        setStatus(data as unknown as CameraStatus);
      }
    );

    return () => {
      unsubJoint();
      unsubHeartbeat();
      unsubLog();
      unsubCameraStatus();
      bridge.disconnect();
    };
  }, [
    setBridgeConnected,
    updateNode,
    addLog,
    setJoints,
    setConfigs,
    setStatus,
    setTorque,
  ]);
}
