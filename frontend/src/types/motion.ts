export type MotionMode = "joint" | "move_tcp" | "pivot";

export interface TCPPose {
  position: [number, number, number]; // [x, y, z] 미터
  quaternion: [number, number, number, number]; // quaternion [x, y, z, w]
}

export interface MoveTCPRequest {
  position: [number, number, number];
  quaternion?: [number, number, number, number] | null;
}

export interface PivotRotateRequest {
  delta_pitch: number; // degree
  delta_yaw: number; // degree
}
