import { create } from "zustand";
import type { TrajectoryState, TCPPose } from "@/types/motion";

interface MotionStore {
  trajectoryState: TrajectoryState | null;
  tcpPose: TCPPose | null;

  setTrajectoryState: (s: TrajectoryState) => void;
  setTcpPose: (p: TCPPose | null) => void;
}

export const useMotionStore = create<MotionStore>((set) => ({
  trajectoryState: null,
  tcpPose: null,

  setTrajectoryState: (s) => set({ trajectoryState: s }),
  setTcpPose: (p) => set({ tcpPose: p }),
}));
