import { useCallback, useState } from "react";
import type { CalibrationResults } from "@/hooks/useCalibrationResults";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import * as THREE from "three";
import { URDFRobot } from "./URDFRobot";
import { AxisFrame } from "./AxisFrame";
import { CameraFrustum } from "./CameraFrustum";

interface SceneOptions {
  showRobot: boolean;
  showBaseFrame: boolean;
  showTCPFrame: boolean;
  showCameraFrame: boolean;
  showGrid: boolean;
}

interface RobotSceneProps {
  jointAngles: number[];
  calibration: CalibrationResults | null;
  options: SceneOptions;
  onTCPMatrix?: (m: THREE.Matrix4 | null) => void;
}

function buildMatrix4(R: number[][], t: number[][]): THREE.Matrix4 {
  const flat_t = t.flat();
  // prettier-ignore
  return new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], flat_t[0],
    R[1][0], R[1][1], R[1][2], flat_t[1],
    R[2][0], R[2][1], R[2][2], flat_t[2],
    0,       0,       0,       1
  );
}

function SceneContent({
  jointAngles,
  calibration,
  options,
  onTCPMatrix,
}: RobotSceneProps) {
  const [tcpMatrix, setTcpMatrix] = useState<THREE.Matrix4 | null>(null);

  const handleTCPMatrix = useCallback(
    (m: THREE.Matrix4) => {
      setTcpMatrix(m);
      onTCPMatrix?.(m);
    },
    [onTCPMatrix]
  );

  const cameraMatrix =
    calibration?.hand_eye?.R && calibration?.hand_eye?.t
      ? buildMatrix4(calibration.hand_eye.R, calibration.hand_eye.t)
      : null;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} color="#b0c8e0" />
      <directionalLight
        position={[0.5, 1, 0.5]}
        intensity={1.2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight
        position={[-0.5, 0.2, -0.5]}
        intensity={0.3}
        color="#6699bb"
      />

      {/* Environment for reflections */}
      <Environment preset="city" />

      {/* Ground Grid */}
      {options.showGrid && (
        <Grid
          args={[0.6, 0.6]}
          cellSize={0.05}
          cellThickness={0.5}
          cellColor="#1a3a5a"
          sectionSize={0.1}
          sectionThickness={1}
          sectionColor="#2a5a8a"
          fadeDistance={1.5}
          fadeStrength={1}
          followCamera={false}
          position={[0, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]} // lie flat on XY plane (Z up)
        />
      )}

      {/* World / Base frame at origin */}
      {options.showBaseFrame && (
        <AxisFrame size={0.06} label="BASE" labelColor="#ffffff" />
      )}

      {/* Robot model with live joint angles */}
      {options.showRobot && (
        <URDFRobot jointAngles={jointAngles} onTCPMatrix={handleTCPMatrix} />
      )}

      {/* TCP frame — follows end-effector matrix from urdf-loader */}
      {options.showTCPFrame && tcpMatrix && (
        <AxisFrame
          matrix={tcpMatrix}
          size={0.04}
          label="TCP"
          labelColor="#ffcc44"
        />
      )}

      {/* Camera frame — from hand-eye calibration */}
      {options.showCameraFrame && cameraMatrix && (
        <group>
          <AxisFrame
            matrix={cameraMatrix}
            size={0.04}
            label="CAMERA"
            labelColor="#00e5ff"
          />
          {calibration?.intrinsic && (
            // Position frustum at the camera frame origin
            <group
              position={new THREE.Vector3()
                .setFromMatrixPosition(cameraMatrix)
                .toArray()}
              quaternion={new THREE.Quaternion().setFromRotationMatrix(
                cameraMatrix
              )}
            >
              <CameraFrustum intrinsic={calibration.intrinsic} depth={0.12} />
            </group>
          )}
        </group>
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.1}
        maxDistance={2}
        target={[0, 0.1, 0]}
      />
    </>
  );
}

export function RobotScene(props: RobotSceneProps) {
  return (
    <Canvas
      camera={{ position: [0.4, 0.35, 0.4], fov: 45, near: 0.001, far: 10 }}
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#080c12" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
