import { create } from "zustand";
import type { Joint, MotorConfig } from "@/types/motor";

interface RobotStore {
  joints: Joint[];
  configs: MotorConfig[];
  torqueEnabled: boolean;
  setJoints: (joints: Joint[]) => void;
  setConfigs: (configs: MotorConfig[]) => void;
  setTorque: (enabled: boolean) => void;
}

export const useRobotStore = create<RobotStore>((set) => ({
  joints: [],
  configs: [],
  torqueEnabled: false,
  setJoints: (joints) => set({ joints }),
  setConfigs: (configs) => set({ configs }),
  setTorque: (enabled) => set({ torqueEnabled: enabled }),
}));
