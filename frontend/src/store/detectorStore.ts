import { create } from "zustand";

export interface Detection {
  class: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  conf: number;
}

interface DetectorStore {
  detections: Detection[];
  timestamp: number;
  setDetections: (detections: Detection[], timestamp: number) => void;
}

export const useDetectorStore = create<DetectorStore>((set) => ({
  detections: [],
  timestamp: 0,
  setDetections: (detections, timestamp) => set({ detections, timestamp }),
}));
