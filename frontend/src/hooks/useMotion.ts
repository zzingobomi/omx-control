import { useState, useCallback } from "react";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";
import type {
  TCPPose,
  MoveTCPRequest,
  PivotRotateRequest,
} from "@/types/motion";

interface UseMotionReturn {
  tcpPose: TCPPose | null;
  pivotActive: boolean;
  loading: boolean;
  error: string | null;
  getTCP: () => Promise<void>;
  moveTCP: (req: MoveTCPRequest) => Promise<boolean>;
  pivotSet: () => Promise<boolean>;
  pivotRotate: (req: PivotRotateRequest) => Promise<boolean>;
  pivotClear: () => Promise<void>;
}

export function useMotion(): UseMotionReturn {
  const [tcpPose, setTcpPose] = useState<TCPPose | null>(null);
  const [pivotActive, setPivotActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTCP = useCallback(async () => {
    const res = await bridge.callService(ServiceKey.MOTION_GET_TCP, {});
    if (res.success) {
      setTcpPose(res.data as unknown as TCPPose);
      setError(null);
    } else {
      setError(res.message);
    }
  }, []);

  const moveTCP = useCallback(async (req: MoveTCPRequest): Promise<boolean> => {
    setLoading(true);
    const res = await bridge.callService(
      ServiceKey.MOTION_MOVE_TCP,
      req as unknown as Record<string, unknown>,
    );
    setLoading(false);
    if (!res.success) setError(res.message);
    else setError(null);
    return res.success;
  }, []);

  const pivotSet = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const res = await bridge.callService(ServiceKey.MOTION_PIVOT_SET, {});
    setLoading(false);
    if (res.success) {
      setPivotActive(true);
      setTcpPose(res.data as unknown as TCPPose);
      setError(null);
    } else {
      setError(res.message);
    }
    return res.success;
  }, []);

  const pivotRotate = useCallback(
    async (req: PivotRotateRequest): Promise<boolean> => {
      const res = await bridge.callService(
        ServiceKey.MOTION_PIVOT_ROTATE,
        req as unknown as Record<string, unknown>,
      );
      if (!res.success) setError(res.message);
      else setError(null);
      return res.success;
    },
    [],
  );

  const pivotClear = useCallback(async () => {
    await bridge.callService(ServiceKey.MOTION_PIVOT_CLEAR, {});
    setPivotActive(false);
    setError(null);
  }, []);

  return {
    tcpPose,
    pivotActive,
    loading,
    error,
    getTCP,
    moveTCP,
    pivotSet,
    pivotRotate,
    pivotClear,
  };
}
