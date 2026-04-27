import { useRobotStore } from "@/store/robotStore";
import { useCallback } from "react";
import { bridge } from "@/api/bridge";
import { Topic, ServiceKey } from "@/constants/topics";
import type { MoveJRequest } from "@/types/motion";
import { useMotion } from "@/hooks/useMotion";
import { ARM_JOINTS } from "@/lib/robot/config";

export function useJointControl() {
  const torqueEnabled = useRobotStore((s) => s.torqueEnabled);
  const setTorque = useRobotStore((s) => s.setTorque);
  const configs = useRobotStore((s) => s.configs);
  const motion = useMotion();

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

  const goHome = useCallback(async () => {
    const req: MoveJRequest = {
      joints: ARM_JOINTS.map((j) => ({
        id: j.id,
        position: configs.find((c) => c.id === j.id)?.home ?? 0,
      })),
      duration: 3.0,
    };

    await motion.moveJ(req);
  }, [motion, configs]);

  return { torqueEnabled, sendJointCmd, sendAllJoints, enableTorque, goHome };
}
