export type MotionMode = "joint" | "move_tcp" | "orbit" | "move_j" | "move_l";

export type Vec3 = [number, number, number];
export type Quaternion = [number, number, number, number];

export interface TCPPose {
  position: Vec3; // [x, y, z] 미터
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
export interface JointTarget {
  id: number;
  position: number; // Dynamixel raw (0 ~ 4095)
}

export interface MoveJRequest {
  joints: JointTarget[];
  duration: number; // seconds
}

// ─── MoveL ───────────────────────────────────────────────────
export interface MoveLRequest {
  position: Vec3; // 미터 단위 (URDF 기준)
  duration: number; // seconds
}

// ─── 트래젝토리 실행 상태 (omx/motion/state/trajectory 토픽) ──
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
