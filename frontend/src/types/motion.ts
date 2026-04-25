export type MotionMode = "joint" | "move_tcp" | "orbit";

export type Vec3 = [number, number, number];
export type Quaternion = [number, number, number, number];

export interface TCPPose {
  position: Vec3; // [x, y, z] 미터
  quaternion: Quaternion;
}

export interface MoveTCPRequest {
  position: Vec3;
}

export interface OrbitRotateRequest {
  delta_pitch: number; // degree
  delta_yaw: number; // degree
}
