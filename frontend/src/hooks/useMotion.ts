import { useState, useCallback } from "react";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";
import type {
  TCPPose,
  MoveTCPRequest,
  OrbitRotateRequest,
} from "@/types/motion";

interface UseMotionReturn {
  tcpPose: TCPPose | null;
  orbitActive: boolean;
  loading: boolean;
  error: string | null;
  getTCP: () => Promise<void>;
  moveTCP: (req: MoveTCPRequest) => Promise<boolean>;
  orbitSet: () => Promise<boolean>;
  orbitRotate: (req: OrbitRotateRequest) => Promise<boolean>;
  orbitClear: () => Promise<void>;
}

export function useMotion(): UseMotionReturn {
  const [tcpPose, setTcpPose] = useState<TCPPose | null>(null);
  const [orbitActive, setOrbitActive] = useState(false);
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
      req as unknown as Record<string, unknown>
    );
    setLoading(false);
    if (!res.success) setError(res.message);
    else setError(null);
    return res.success;
  }, []);

  const orbitSet = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    const res = await bridge.callService(ServiceKey.MOTION_ORBIT_SET, {});
    setLoading(false);
    if (res.success) {
      setOrbitActive(true);
      setTcpPose(res.data as unknown as TCPPose);
      setError(null);
    } else {
      setError(res.message);
    }
    return res.success;
  }, []);

  const orbitRotate = useCallback(
    async (req: OrbitRotateRequest): Promise<boolean> => {
      const res = await bridge.callService(
        ServiceKey.MOTION_ORBIT_ROTATE,
        req as unknown as Record<string, unknown>
      );
      if (!res.success) setError(res.message);
      else setError(null);
      return res.success;
    },
    []
  );

  const orbitClear = useCallback(async () => {
    await bridge.callService(ServiceKey.MOTION_ORBIT_CLEAR, {});
    setOrbitActive(false);
    setError(null);
  }, []);

  return {
    tcpPose,
    orbitActive,
    loading,
    error,
    getTCP,
    moveTCP,
    orbitSet,
    orbitRotate,
    orbitClear,
  };
}
