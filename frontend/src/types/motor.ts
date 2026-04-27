export interface Joint {
  id: number;
  name: string;
  position: number; // raw value (0~4095)
  degree: number; // 각도 (0~360)
  velocity: number;
  torque: number;
}

export interface JointState {
  timestamp: number;
  joints: Joint[];
}

export interface JointCmd {
  id: number;
  position: number; // raw value
}

export interface MotorConfig {
  id: number;
  name: string;
  model: string;
  mode: string;
  home: number;
  limit: { min: number; max: number };
}
