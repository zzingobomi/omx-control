// components/three/AxisFrame.tsx
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";

interface AxisFrameProps {
  /** 4x4 column-major matrix (THREE.js style) or leave unset for identity */
  matrix?: THREE.Matrix4;
  /** Scale for the arrow length in meters (default 0.05 = 5cm) */
  size?: number;
  label?: string;
  labelColor?: string;
  opacity?: number;
}

const ARROW_RADIUS = 0.003;
const CONE_RADIUS = 0.007;
const CONE_HEIGHT = 0.018;

function Arrow({
  direction,
  color,
  length,
}: {
  direction: [number, number, number];
  color: string;
  length: number;
}) {
  const bodyLength = length - CONE_HEIGHT;
  const dir = new THREE.Vector3(...direction);

  // Rotation: align Y-axis (cylinder default) to direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [dir]);

  const bodyPos = dir.clone().multiplyScalar(bodyLength / 2);
  const conePos = dir.clone().multiplyScalar(bodyLength + CONE_HEIGHT / 2);

  return (
    <group quaternion={quaternion}>
      {/* Shaft */}
      <mesh position={bodyPos.toArray()}>
        <cylinderGeometry args={[ARROW_RADIUS, ARROW_RADIUS, bodyLength, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Tip */}
      <mesh position={conePos.toArray()}>
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 8]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

export function AxisFrame({
  matrix,
  size = 0.05,
  label,
  labelColor = "#ffffff",
  opacity = 1,
}: AxisFrameProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Apply matrix every frame so it reacts to live updates
  useFrame(() => {
    if (!groupRef.current || !matrix) return;
    groupRef.current.matrix.copy(matrix);
    groupRef.current.matrix.decompose(
      groupRef.current.position,
      groupRef.current.quaternion,
      groupRef.current.scale
    );
  });

  return (
    <group ref={groupRef} matrixAutoUpdate={!matrix}>
      <Arrow direction={[1, 0, 0]} color="#ff3333" length={size} />
      <Arrow direction={[0, 1, 0]} color="#33ff66" length={size} />
      <Arrow direction={[0, 0, 1]} color="#3399ff" length={size} />

      {/* Origin dot */}
      <mesh>
        <sphereGeometry args={[ARROW_RADIUS * 1.8, 8, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {label && (
        <Text
          position={[0, size + 0.012, 0]}
          fontSize={0.018}
          color={labelColor}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.002}
          outlineColor="#000000"
        >
          {label}
        </Text>
      )}
    </group>
  );
}
