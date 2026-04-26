import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import URDFLoader from "urdf-loader";
import { BASE_URL } from "@/constants";

const ARM_JOINT_NAMES = ["joint1", "joint2", "joint3", "joint4", "joint5"];

export function URDFRobot() {
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
      if (robotRef.current && groupRef.current) {
        groupRef.current.remove(robotRef.current);
        robotRef.current = null;
      }
      loadedRef.current = false;
    };
  }, [applyMaterial]);

  return <group ref={groupRef} />;
}
