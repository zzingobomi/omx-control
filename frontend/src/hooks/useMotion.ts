import { useState, useCallback } from "react";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";
import type {
  TCPPose,
  MoveTCPRequest,
  OrbitRotateRequest,
  MoveJRequest,
  MoveLRequest,
  TrajectoryState,
} from "@/types/motion";
import { useMotionStore } from "@/store/motionStore";

interface UseMotionReturn {
  tcpPose: TCPPose | null;
  orbitActive: boolean;
  trajectoryState: TrajectoryState | null;
  loading: boolean;
  error: string | null;

  // TCP
  getTCP: () => Promise<TCPPose | null>;
  moveTCP: (req: MoveTCPRequest) => Promise<boolean>;

  // Orbit
  orbitSet: () => Promise<boolean>;
  orbitRotate: (req: OrbitRotateRequest) => Promise<boolean>;
  orbitClear: () => Promise<void>;

  // MoveJ / MoveL
  moveJ: (req: MoveJRequest) => Promise<boolean>;
  moveL: (req: MoveLRequest) => Promise<boolean>;
  stopMotion: () => Promise<void>;
}

export function useMotion(): UseMotionReturn {
  const { tcpPose, orbitActive, trajectoryState, setTcpPose, setOrbitActive } =
    useMotionStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── TCP ──────────────────────────────────────────────

  const getTCP = useCallback(async (): Promise<TCPPose | null> => {
    const res = await bridge.callService(ServiceKey.MOTION_GET_TCP, {});
    if (res.success) {
      const pose = res.data as unknown as TCPPose;
      setTcpPose(pose);
      setError(null);
      return pose;
    }
    setError(res.message);
    return null;
  }, [setTcpPose]);

  const moveTCP = useCallback(async (req: MoveTCPRequest) => {
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

  // ─── Orbit ─────────────────────────────────────────────

  const orbitSet = useCallback(async () => {
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
  }, [setOrbitActive, setTcpPose]);

  const orbitRotate = useCallback(async (req: OrbitRotateRequest) => {
    const res = await bridge.callService(
      ServiceKey.MOTION_ORBIT_ROTATE,
      req as unknown as Record<string, unknown>
    );
    if (!res.success) setError(res.message);
    else setError(null);
    return res.success;
  }, []);

  const orbitClear = useCallback(async () => {
    await bridge.callService(ServiceKey.MOTION_ORBIT_CLEAR, {});
    setOrbitActive(false);
    setError(null);
  }, [setOrbitActive]);

  // ─── MoveJ ─────────────────────────────────────────────

  const moveJ = useCallback(async (req: MoveJRequest) => {
    setLoading(true);
    setError(null);

    const res = await bridge.callService(
      ServiceKey.MOTION_MOVE_J,
      req as unknown as Record<string, unknown>
    );

    setLoading(false);
    if (!res.success) setError(res.message);

    return res.success;
  }, []);

  // ─── MoveL ─────────────────────────────────────────────

  const moveL = useCallback(async (req: MoveLRequest) => {
    setLoading(true);
    setError(null);

    const res = await bridge.callService(
      ServiceKey.MOTION_MOVE_L,
      req as unknown as Record<string, unknown>
    );

    setLoading(false);
    if (!res.success) setError(res.message);

    return res.success;
  }, []);

  // ─── Stop ──────────────────────────────────────────────

  const stopMotion = useCallback(async () => {
    await bridge.callService(ServiceKey.MOTION_STOP, {});
    setError(null);
  }, []);

  return {
    tcpPose,
    orbitActive,
    trajectoryState,
    loading,
    error,
    getTCP,
    moveTCP,
    orbitSet,
    orbitRotate,
    orbitClear,
    moveJ,
    moveL,
    stopMotion,
  };
}
