import { useCallback } from "react";
import { bridge } from "@/api/bridge";
import { useTaskStore } from "@/store/taskStore";
import type { RunTaskRequest, TaskState } from "@/types/task";
import { ServiceKey } from "@/constants/topics";

interface UseTaskReturn {
  taskState: TaskState;
  loading: boolean;
  run: (req: RunTaskRequest) => Promise<boolean>;
  stop: () => Promise<void>;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  syncStatus: () => Promise<void>;
}

export function useTask(): UseTaskReturn {
  const { taskState, loading, setTaskState, setLoading } = useTaskStore();

  const run = useCallback(
    async (req: RunTaskRequest): Promise<boolean> => {
      setLoading(true);
      const res = await bridge.callService(
        ServiceKey.TASK_RUN,
        req as unknown as Record<string, unknown>,
      );
      if (!res.success) {
        setLoading(false);
        return false;
      }
      return true;
    },
    [setLoading],
  );

  const stop = useCallback(async () => {
    await bridge.callService(ServiceKey.TASK_STOP, {});
    setLoading(false);
  }, [setLoading]);

  const pause = useCallback(async (): Promise<boolean> => {
    const res = await bridge.callService(ServiceKey.TASK_PAUSE, {});
    return res.success;
  }, []);

  const resume = useCallback(async (): Promise<boolean> => {
    const res = await bridge.callService(ServiceKey.TASK_RESUME, {});
    return res.success;
  }, []);

  const syncStatus = useCallback(async () => {
    const res = await bridge.callService(ServiceKey.TASK_STATUS, {});
    if (res.success && res.data) {
      setTaskState(res.data as unknown as TaskState);
    }
  }, [setTaskState]);

  return { taskState, loading, run, stop, pause, resume, syncStatus };
}
