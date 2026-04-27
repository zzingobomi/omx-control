export type MotionMode = "joint" | "move_tcp" | "orbit" | "move_j" | "move_l";

export type Vec3 = [number, number, number];
export type Quaternion = [number, number, number, number];

export interface TCPPose {
  position: Vec3; // [x, y, z] meter
  quaternion: Quaternion;
}

// ─── Move TCP ────────────────────────────────────────────────
export interface MoveTCPRequest {
  position: Vec3;
}

// ─── Orbit ───────────────────────────────────────────────────
export interface OrbitRotateRequest {
  delta_pitch: number; // degree
  delta_yaw: number; // degree
}

// ─── MoveJ ───────────────────────────────────────────────────
export interface MoveJRequest {
  joints: Array<{
    id: number;
    degree: number;
  }>;
}

// ─── MoveL ───────────────────────────────────────────────────
export interface MoveLRequest {
  position: Vec3; // [x, y, z] meter
}

export type TrajectoryStatus =
  | "running"
  | "done"
  | "failed"
  | "stopped"
  | "idle";

export interface TrajectoryState {
  status: TrajectoryStatus;
  progress: number; // 0.0 ~ 1.0
  timestamp: number;
}
