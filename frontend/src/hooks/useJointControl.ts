import { useRobotStore } from "@/store/robotStore";
import { useCallback } from "react";
import { bridge } from "@/api/bridge";
import { Topic, ServiceKey } from "@/constants/topics";

export function useJointControl() {
  const torqueEnabled = useRobotStore((s) => s.torqueEnabled);
  const setTorque = useRobotStore((s) => s.setTorque);

  const sendJointCmd = useCallback((id: number, position: number) => {
    bridge.publish(Topic.MOTOR_CMD_JOINT, {
      timestamp: Date.now() / 1000,
      joints: [{ id, position }],
    });
  }, []);

  const sendAllJoints = useCallback(
    (joints: { id: number; position: number }[]) => {
      bridge.publish(Topic.MOTOR_CMD_JOINT, {
        timestamp: Date.now() / 1000,
        joints,
      });
    },
    []
  );

  const enableTorque = useCallback(
    async (enable: boolean) => {
      const res = await bridge.callService(ServiceKey.MOTOR_ENABLE, { enable });
      if (res.success) setTorque(enable);
      return res;
    },
    [setTorque]
  );

  const goHome = useCallback(() => {
    const joints = [1, 2, 3, 4, 5, 6].map((id) => ({ id, position: 2048 }));
    bridge.publish(Topic.MOTOR_CMD_JOINT, {
      timestamp: Date.now() / 1000,
      joints,
    });
  }, []);

  return { torqueEnabled, sendJointCmd, sendAllJoints, enableTorque, goHome };
}
