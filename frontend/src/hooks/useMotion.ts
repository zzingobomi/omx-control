import { useState, useCallback, useEffect, useRef } from "react";
import { bridge } from "@/api/bridge";
import { ServiceKey, Topic } from "@/constants/topics";
import type {
  TCPPose,
  MoveTCPRequest,
  OrbitRotateRequest,
  MoveJRequest,
  MoveLRequest,
  TrajectoryState,
} from "@/types/motion";

interface UseMotionReturn {
  // TCP 상태
  tcpPose: TCPPose | null;
  // Orbit 상태
  orbitActive: boolean;
  // 트래젝토리 실행 상태
  trajectoryState: TrajectoryState | null;
  // 공통
  loading: boolean;
  error: string | null;
  // Move TCP (step 방식)
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
  const [tcpPose, setTcpPose] = useState<TCPPose | null>(null);
  const [orbitActive, setOrbitActive] = useState(false);
  const [trajectoryState, setTrajectoryState] =
    useState<TrajectoryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // omx/motion/state/trajectory 토픽 구독
  const unsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    unsubRef.current = bridge.subscribe(
      Topic.MOTION_STATE_TRAJ,
      (data: unknown) => {
        setTrajectoryState(data as TrajectoryState);
      }
    );
    return () => {
      unsubRef.current?.();
    };
  }, []);

  // ─── Move TCP ──────────────────────────────────────────────

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

  // ─── Orbit ─────────────────────────────────────────────────

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

  const orbitClear = useCallback(async (): Promise<void> => {
    await bridge.callService(ServiceKey.MOTION_ORBIT_CLEAR, {});
    setOrbitActive(false);
    setError(null);
  }, []);

  // ─── MoveJ ─────────────────────────────────────────────────

  const moveJ = useCallback(async (req: MoveJRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const res = await bridge.callService(
      ServiceKey.MOTOR_MOVE_J,
      req as unknown as Record<string, unknown>
    );
    setLoading(false);
    if (!res.success) setError(res.message);
    return res.success;
  }, []);

  // ─── MoveL ─────────────────────────────────────────────────

  const moveL = useCallback(async (req: MoveLRequest): Promise<boolean> => {
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

  // ─── Stop ──────────────────────────────────────────────────

  const stopMotion = useCallback(async (): Promise<void> => {
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
