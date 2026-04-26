import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import URDFLoader from "urdf-loader";
import { BASE_URL } from "@/constants";

const ARM_JOINT_NAMES = ["joint1", "joint2", "joint3", "joint4", "joint5"];
const TCP_LINK_NAME = "end_effector_link";

interface URDFRobotProps {
  jointAngles: number[];
  onTCPMatrix?: (matrix: THREE.Matrix4) => void;
}

export function URDFRobot({ jointAngles, onTCPMatrix }: URDFRobotProps) {
  const groupRef = useRef<THREE.Group>(null);
  const robotRef = useRef<any>(null);
  const loadedRef = useRef(false);

  const applyMaterial = useCallback((robot: any) => {
    robot.traverse((child: any) => {
      if (!child.isMesh) return;
      child.material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(0x1e2d3d),
        specular: new THREE.Color(0x4a7fa5),
        shininess: 60,
        emissive: new THREE.Color(0x0a1520),
      });
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loader = new URDFLoader();
    const currentGroup = groupRef.current;

    // Adjust the package name if omx_f.urdf uses a different package name.
    loader.packages = {
      omx_description: `${BASE_URL}/robot`,
      omx_f: `${BASE_URL}/robot`,
    };
    loader.workingPath = `${BASE_URL}/robot/urdf/omx_f/`;

    loader.load(
      `${BASE_URL}/robot/urdf/omx_f/omx_f.urdf`,
      (robot: any) => {
        robotRef.current = robot;
        applyMaterial(robot);
        groupRef.current?.add(robot);
      },
      undefined,
      (err: unknown) => console.error("[URDFRobot] load error:", err)
    );

    return () => {
      if (robotRef.current && currentGroup) {
        currentGroup.remove(robotRef.current);
        robotRef.current = null;
      }
      loadedRef.current = false;
    };
  }, [applyMaterial]);

  useEffect(() => {
    const robot = robotRef.current;
    if (!robot) return;

    ARM_JOINT_NAMES.forEach((name, i) => {
      const angle = jointAngles[i];
      if (angle !== undefined && robot.joints?.[name]) {
        robot.setJointValue(name, angle);
      }
    });

    if (onTCPMatrix && robot.links?.[TCP_LINK_NAME]) {
      const link = robot.links[TCP_LINK_NAME];

      link.updateWorldMatrix(true, false);
      onTCPMatrix(link.matrixWorld.clone());
    }
  }, [jointAngles, onTCPMatrix]);

  return <group ref={groupRef} />;
}
