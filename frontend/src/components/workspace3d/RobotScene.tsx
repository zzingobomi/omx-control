import type { CalibrationResults } from "@/hooks/useCalibrationResults";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import * as THREE from "three";
import { URDFRobot } from "./URDFRobot";
import { AxisFrame } from "./AxisFrame";

interface SceneOptions {
  showRobot: boolean;
  showBaseFrame: boolean;
  showTCPFrame: boolean;
  showCameraFrame: boolean;
  showGrid: boolean;
}

interface RobotSceneProps {
  calibration: CalibrationResults | null;
  options: SceneOptions;
  onTCPMatrix?: (m: THREE.Matrix4 | null) => void;
}

function SceneContent({ calibration, options, onTCPMatrix }: RobotSceneProps) {
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

      {/* robot z-up 을 맞추기 위해 전체 그룹을 x-90도 회전 */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
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
        {options.showRobot && <URDFRobot />}
      </group>

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
