import { create } from "zustand";
import type { TrajectoryState, TCPPose } from "@/types/motion";

interface MotionStore {
  trajectoryState: TrajectoryState | null;
  tcpPose: TCPPose | null;
  orbitActive: boolean;

  setTrajectoryState: (s: TrajectoryState) => void;
  setTcpPose: (p: TCPPose | null) => void;
  setOrbitActive: (v: boolean) => void;
}

export const useMotionStore = create<MotionStore>((set) => ({
  trajectoryState: null,
  tcpPose: null,
  orbitActive: false,

  setTrajectoryState: (s) => set({ trajectoryState: s }),
  setTcpPose: (p) => set({ tcpPose: p }),
  setOrbitActive: (v) => set({ orbitActive: v }),
}));
