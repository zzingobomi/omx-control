import { CameraFeed } from "@/components/camera/CameraFeed";
import { CoordInput } from "@/components/common/CoordInput";
import { StepProgress } from "@/components/common/StepProgress";
import { DetectionOverlay } from "@/components/detector/DetectionOverlay";
import { useTask } from "@/hooks/useTask";
import type { Vec3 } from "@/types/motion";
import type { TaskStatus } from "@/types/task";
import { useEffect, useRef, useState } from "react";

const DEFAULT_PLACE: Vec3 = [0.15, 0.0, 0.05];

const STATUS_COLOR: Record<TaskStatus, string> = {
  idle: "text-zinc-400",
  running: "text-emerald-400",
  paused: "text-amber-400",
  success: "text-sky-400",
  failed: "text-red-400",
  stopped: "text-zinc-500",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  idle: "IDLE",
  running: "RUNNING",
  paused: "PAUSED",
  success: "SUCCESS",
  failed: "FAILED",
  stopped: "STOPPED",
};

export function PickAndPlace() {
  const { taskState, loading, run, stop, pause, resume, syncStatus } =
    useTask();
  const [placePos, setPlacePos] = useState<Vec3>(DEFAULT_PLACE);

  // 카메라 컨테이너 실제 렌더 크기 측정
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDisplaySize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isActive =
    taskState.status === "running" || taskState.status === "paused";

  useEffect(() => {
    syncStatus();
  }, [syncStatus]);

  const setAxis = (idx: 0 | 1 | 2) => (v: number) =>
    setPlacePos((prev) => {
      const next = [...prev] as Vec3;
      next[idx] = v;
      return next;
    });

  const handleRun = () =>
    run({ task: "pick_and_place", place_position: placePos });

  const handlePauseResume = () =>
    taskState.status === "paused" ? resume() : pause();

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">
        Pick &amp; Place
      </h1>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── 왼쪽: 카메라 + 진행 상태 ── */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">
          <div
            ref={containerRef}
            className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700/50 aspect-video"
          >
            <CameraFeed />

            {/* Detection bbox 오버레이 */}
            {displaySize.width > 0 && (
              <DetectionOverlay
                frameWidth={1280}
                frameHeight={720}
                displayWidth={displaySize.width}
                displayHeight={displaySize.height}
              />
            )}

            {/* Task 상태 오버레이 */}
            <div className="absolute top-2 left-2 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md">
              <span
                className={`font-mono text-xs font-bold ${
                  STATUS_COLOR[taskState.status]
                }`}
              >
                {STATUS_LABEL[taskState.status]}
              </span>
              {taskState.status === "running" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          </div>

          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 space-y-3">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Progress
            </p>
            <StepProgress
              currentStep={taskState.current_step}
              totalSteps={taskState.total_steps}
              currentLabel={taskState.current_label}
            />
            {taskState.error && (
              <p className="font-mono text-xs text-red-400 break-all">
                {taskState.error}
              </p>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 설정 + 컨트롤 ── */}
        <div className="flex flex-col gap-4 w-64 shrink-0">
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 space-y-3">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest">
              Place Position
            </p>
            <div className="space-y-2">
              <CoordInput
                axis="X"
                value={placePos[0]}
                onChange={setAxis(0)}
                disabled={isActive}
              />
              <CoordInput
                axis="Y"
                value={placePos[1]}
                onChange={setAxis(1)}
                disabled={isActive}
              />
              <CoordInput
                axis="Z"
                value={placePos[2]}
                onChange={setAxis(2)}
                disabled={isActive}
              />
            </div>
          </div>

          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 space-y-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">
              Control
            </p>
            <button
              onClick={handleRun}
              disabled={isActive || loading}
              className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {loading ? "Starting..." : "Run"}
            </button>
            <button
              onClick={handlePauseResume}
              disabled={!isActive}
              className="w-full h-10 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {taskState.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              onClick={stop}
              disabled={!isActive}
              className="w-full h-10 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              Stop
            </button>
          </div>

          {taskState.task_name && (
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">
                Task
              </p>
              <p className="font-mono text-xs text-zinc-300">
                {taskState.task_name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
