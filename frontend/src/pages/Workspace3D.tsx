import { useState } from "react";
import { RobotScene } from "@/components/workspace3d/RobotScene";
import { useCalibrationResults } from "@/hooks/useCalibrationResults";

interface SceneOptions {
  showRobot: boolean;
  showBaseFrame: boolean;
  showTCPFrame: boolean;
  showCameraFrame: boolean;
  showGrid: boolean;
}

export function Workspace3D() {
  const { results, status, loading, error, refetch } = useCalibrationResults();

  const [options, setOptions] = useState<SceneOptions>({
    showRobot: true,
    showBaseFrame: true,
    showTCPFrame: true,
    showCameraFrame: true,
    showGrid: true,
  });

  return (
    <div
      className="h-full flex bg-[#080c12] text-zinc-100"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* ── 3D Canvas ── */}
      <div className="flex-1 relative">
        <RobotScene calibration={results} options={options} />
      </div>
    </div>
  );
}
