export const Topic = {
  // Motor
  MOTOR_STATE_JOINT: "omx/motor/state/joint",
  MOTOR_CMD_JOINT: "omx/motor/cmd/joint",

  // Camera
  CAMERA_STREAM_RAW: "omx/camera/stream/raw",
  CAMERA_STATE_STATUS: "omx/camera/state/status",

  // System
  SYSTEM_HEARTBEAT: "omx/system/heartbeat",
  SYSTEM_LOG: "omx/system/log",
} as const;

export const ServiceKey = {
  // Motor
  MOTOR_ENABLE: "omx/motor/srv/enable",
  MOTOR_SET_PROFILE: "omx/motor/srv/set_profile",
  MOTOR_REBOOT: "omx/motor/srv/reboot",
  MOTOR_GET_CONFIG: "omx/motor/srv/get_config",

  // Motion
  MOTION_GET_TCP: "omx/motion/srv/get_tcp",
  MOTION_MOVE_TCP: "omx/motion/srv/move_tcp",
  MOTION_PIVOT_SET: "omx/motion/srv/pivot_set",
  MOTION_PIVOT_ROTATE: "omx/motion/srv/pivot_rotate",
  MOTION_PIVOT_CLEAR: "omx/motion/srv/pivot_clear",

  // Calibration
  CALIB_CAPTURE: "omx/calib/srv/capture",
  CALIB_INTRINSIC_START: "omx/calib/srv/intrinsic/start",
  CALIB_INTRINSIC_SAVE: "omx/calib/srv/intrinsic/save",
  CALIB_HANDEYE_START: "omx/calib/srv/handeye/start",
  CALIB_HANDEYE_SAVE: "omx/calib/srv/handeye/save",

  // System
  SYSTEM_NODE_STATUS: "omx/system/srv/node_status",
} as const;
