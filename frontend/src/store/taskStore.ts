import { create } from "zustand";
import type { TaskState } from "@/types/task";
import { defaultTaskState } from "@/types/task";

interface TaskStore {
  taskState: TaskState;
  loading: boolean;
  setTaskState: (s: TaskState) => void;
  setLoading: (v: boolean) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  taskState: defaultTaskState,
  loading: false,
  setTaskState: (s) => set({ taskState: s }),
  setLoading: (v) => set({ loading: v }),
}));
