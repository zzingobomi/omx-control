import { useState, useCallback } from "react";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";
import type {
  TCPPose,
  MoveTCPRequest,
  MoveJRequest,
  MoveLRequest,
  MoveCRequest,
  MovePRequest,
  TrajectoryState,
} from "@/types/motion";
import { useMotionStore } from "@/store/motionStore";

interface UseMotionReturn {
  tcpPose: TCPPose | null;
  trajectoryState: TrajectoryState | null;
  loading: boolean;
  error: string | null;

  // TCP
  getTCP: () => Promise<TCPPose | null>;
  moveTCP: (req: MoveTCPRequest) => Promise<boolean>;

  // MoveJ / MoveL / MoveC / MoveP
  moveJ: (req: MoveJRequest) => Promise<boolean>;
  moveL: (req: MoveLRequest) => Promise<boolean>;
  moveC: (req: MoveCRequest) => Promise<boolean>;
  moveP: (req: MovePRequest) => Promise<boolean>;
  stopMotion: () => Promise<void>;
}

export function useMotion(): UseMotionReturn {
  const { tcpPose, trajectoryState, setTcpPose } = useMotionStore();

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

  // ─── MoveC ─────────────────────────────────────────────

  const moveC = useCallback(async (req: MoveCRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const res = await bridge.callService(
      ServiceKey.MOTION_MOVE_C,
      req as unknown as Record<string, unknown>
    );

    setLoading(false);
    if (!res.success) setError(res.message);

    return res.success;
  }, []);

  // ─── MoveP ─────────────────────────────────────────────

  const moveP = useCallback(async (req: MovePRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const res = await bridge.callService(
      ServiceKey.MOTION_MOVE_P,
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
    trajectoryState,
    loading,
    error,
    getTCP,
    moveTCP,
    moveJ,
    moveL,
    moveC,
    moveP,
    stopMotion,
  };
}
