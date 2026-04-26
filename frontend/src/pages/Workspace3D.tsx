import { useCallback, useMemo, useState } from "react";
import * as THREE from "three";
import { RobotScene } from "@/components/workspace3d/RobotScene";
import { useCalibrationResults } from "@/hooks/useCalibrationResults";
import { useRobotStore } from "@/store/robotStore";
import { Loader2, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ToggleRow } from "@/components/common/ToggleRow";
import { MatrixTable } from "@/components/common/MatrixTable";

interface SceneOptions {
  showRobot: boolean;
  showBaseFrame: boolean;
  showTCPFrame: boolean;
  showCameraFrame: boolean;
  showGrid: boolean;
}

export function Workspace3D() {
  const { results, status, loading, error, refetch } = useCalibrationResults();

  const joints = useRobotStore((s) => s.joints);
  const jointAngles = useMemo<number[]>(() => {
    if (!joints || joints.length === 0) return [0, 0, 0, 0, 0];
    return joints
      .filter((j) => j.id >= 1 && j.id <= 5)
      .sort((a, b) => a.id - b.id)
      .map((j) => {
        if (j.degree !== undefined) {
          return (j.degree * Math.PI) / 180;
        }
        if (j.position !== undefined) {
          return ((j.position - 2048) / 4095) * 2 * Math.PI;
        }
        return 0;
      });
  }, [joints]);

  const [options, setOptions] = useState<SceneOptions>({
    showRobot: true,
    showBaseFrame: true,
    showTCPFrame: true,
    showCameraFrame: true,
    showGrid: true,
  });

  const [tcpMatrix, setTcpMatrix] = useState<THREE.Matrix4 | null>(null);
  const handleTCPMatrix = useCallback(
    (m: THREE.Matrix4 | null) => setTcpMatrix(m),
    []
  );

  const toggle = useCallback((key: keyof SceneOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const tcpPos = tcpMatrix
    ? new THREE.Vector3().setFromMatrixPosition(tcpMatrix)
    : null;

  return (
    <div
      className="h-full flex bg-[#080c12] text-zinc-100"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* ── 3D Canvas ── */}
      <div className="flex-1 relative">
        <RobotScene
          jointAngles={jointAngles}
          calibration={results}
          options={options}
          onTCPMatrix={handleTCPMatrix}
        />

        {/* Overlay: axis legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[10px] font-mono select-none">
          {[
            ["#ff3333", "X"],
            ["#33ff66", "Y"],
            ["#3399ff", "Z"],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-5 h-0.5" style={{ background: c }} />
              <span style={{ color: c }}>{l}</span>
            </span>
          ))}
          <span className="text-zinc-600 ml-2">
            scroll: zoom · drag: orbit · right: pan
          </span>
        </div>

        {/* Overlay: live indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-400">LIVE</span>
        </div>
      </div>

      {/* ── Info Panel ── */}
      <div className="w-64 flex-shrink-0 border-l border-zinc-800 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-zinc-500 tracking-widest uppercase">
              omx-control
            </p>
            <h1 className="text-sm font-bold tracking-tight">3D View</h1>
          </div>
          <button
            onClick={refetch}
            disabled={loading}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-40"
            title="Reload calibration data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Calibration Status */}
        <div className="px-4 py-3 border-b border-zinc-800 space-y-1.5">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
            Calibration
          </p>
          <StatusBadge ok={status?.intrinsic ?? false} label="Intrinsic" />
          <StatusBadge ok={status?.hand_eye ?? false} label="Hand-Eye" />
          {error && <p className="text-[10px] text-red-400 mt-1">⚠ {error}</p>}
        </div>

        {/* Visibility Toggles */}
        <div className="px-4 py-3 border-b border-zinc-800 space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
            Visibility
          </p>
          <ToggleRow
            label="Robot"
            checked={options.showRobot}
            onChange={() => toggle("showRobot")}
            accentColor="bg-blue-400"
          />
          <ToggleRow
            label="Base Frame"
            checked={options.showBaseFrame}
            onChange={() => toggle("showBaseFrame")}
            accentColor="bg-white"
          />
          <ToggleRow
            label="TCP Frame"
            checked={options.showTCPFrame}
            onChange={() => toggle("showTCPFrame")}
            accentColor="bg-yellow-400"
          />
          <ToggleRow
            label="Camera Frame"
            checked={options.showCameraFrame}
            onChange={() => toggle("showCameraFrame")}
            accentColor="bg-cyan-400"
          />
          <ToggleRow
            label="Grid"
            checked={options.showGrid}
            onChange={() => toggle("showGrid")}
            accentColor="bg-zinc-400"
          />
        </div>

        {/* TCP Pose */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
            TCP Position
          </p>
          {tcpPos ? (
            <div className="font-mono text-[11px] space-y-0.5">
              {(["x", "y", "z"] as const).map((axis, i) => (
                <div key={axis} className="flex justify-between">
                  <span className="text-zinc-500">{axis.toUpperCase()}</span>
                  <span className="text-zinc-200 tabular-nums">
                    {(tcpPos as any)[axis].toFixed(4)} m
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600">No robot model loaded</p>
          )}
        </div>

        {/* Joint Angles */}
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
            Joint Angles
          </p>
          <div className="font-mono text-[11px] space-y-0.5">
            {jointAngles.map((rad, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">J{i + 1}</span>
                <span className="text-zinc-300 tabular-nums">
                  {(rad * (180 / Math.PI)).toFixed(1)}°
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Hand-Eye R, t */}
        {results?.hand_eye?.R && results.hand_eye.t && (
          <div className="px-4 py-3 border-b border-zinc-800 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Hand-Eye Transform
            </p>
            <MatrixTable data={results.hand_eye.R} label="R (3×3)" />
            <MatrixTable data={results.hand_eye.t} label="t [m]" />
          </div>
        )}

        {/* Camera Intrinsics */}
        {results?.intrinsic?.camera_matrix && (
          <div className="px-4 py-3 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              Camera Intrinsics
            </p>
            <MatrixTable
              data={results.intrinsic.camera_matrix}
              label="K (3×3)"
            />
            {results.intrinsic.image_size && (
              <div className="font-mono text-[11px] text-zinc-400">
                {results.intrinsic.image_size[0]} ×{" "}
                {results.intrinsic.image_size[1]} px
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}
      </div>
    </div>
  );
}
