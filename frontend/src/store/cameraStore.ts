import { create } from "zustand";
import type { CameraStatus } from "@/types/camera";

interface CameraStore {
  status: CameraStatus | null;
  setStatus: (status: CameraStatus) => void;
}

export const useCameraStore = create<CameraStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
