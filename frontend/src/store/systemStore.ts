import { create } from "zustand";

export type NodeStatus = "running" | "error" | "stopped";

interface NodeInfo {
  name: string;
  status: NodeStatus;
  timestamp: number;
}

interface SystemStore {
  bridgeConnected: boolean;
  nodes: Record<string, NodeInfo>;
  logs: { timestamp: number; node: string; level: string; message: string }[];
  setBridgeConnected: (connected: boolean) => void;
  updateNode: (name: string, status: NodeStatus, timestamp: number) => void;
  addLog: (log: {
    timestamp: number;
    node: string;
    level: string;
    message: string;
  }) => void;
}

const MAX_LOGS = 200;

export const useSystemStore = create<SystemStore>((set) => ({
  bridgeConnected: false,
  nodes: {},
  logs: [],

  setBridgeConnected: (connected) => set({ bridgeConnected: connected }),

  updateNode: (name, status, timestamp) =>
    set((state) => ({
      nodes: { ...state.nodes, [name]: { name, status, timestamp } },
    })),

  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs.slice(-(MAX_LOGS - 1)), log],
    })),
}));
