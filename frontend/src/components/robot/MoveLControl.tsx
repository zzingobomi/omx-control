import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import type {
  TCPPose,
  MoveLRequest,
  TrajectoryState,
  Vec3,
} from "@/types/motion";
import { mmToMVec3, mToMmVec3 } from "@/lib/robot/utils";

interface Props {
  tcpPose: TCPPose | null;
  trajectoryState: TrajectoryState | null;
  onGetTCP: () => Promise<TCPPose | null>;
  onMoveL: (req: MoveLRequest) => Promise<boolean>;
  onStop: () => Promise<void>;
}

const AXES = ["X", "Y", "Z"] as const;

export function MoveLControl({
  tcpPose,
  trajectoryState,
  onGetTCP,
  onMoveL,
  onStop,
}: Props) {
  const [targetMm, setTargetMm] = useState<Vec3>([0, 0, 0]);
  const [duration, setDuration] = useState(3.0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    const pose = await onGetTCP();
    if (pose) {
      const mm = mToMmVec3(pose.position);
      setTargetMm([
        Math.round(mm[0] * 10) / 10,
        Math.round(mm[1] * 10) / 10,
        Math.round(mm[2] * 10) / 10,
      ]);
      setError(null);
    } else {
      setError("TCP 읽기 실패");
    }
    setSyncing(false);
  }, [onGetTCP]);

  const handleTargetMmChange = (axis: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setTargetMm((prev) => {
        const next: Vec3 = [...prev];
        next[axis] = num;
        return next;
      });
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    const positionM: Vec3 = mmToMVec3(targetMm);
    const ok = await onMoveL({ position: positionM });
    if (!ok) setError("MoveL 실패");
    setLoading(false);
  };

  const isRunning = trajectoryState?.status === "running";
  const progress = Math.round((trajectoryState?.progress ?? 0) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* 현재 TCP 표시 */}
      {tcpPose && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono">
          <p className="text-muted-foreground mb-1">현재 TCP (mm)</p>
          <div className="grid grid-cols-3 gap-2">
            {mToMmVec3(tcpPose.position).map((v, i) => (
              <div key={AXES[i]}>
                <span className="text-muted-foreground">{AXES[i]}: </span>
                <span>{v.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 목표 위치 입력 */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium">목표 위치 (mm)</Label>
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((ax, i) => (
            <div key={ax} className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground">{ax}</Label>
              <Input
                type="number"
                step={1}
                value={targetMm[i]}
                onChange={(e) => handleTargetMmChange(i, e.target.value)}
                className="h-8 text-xs text-right"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Duration</Label>
        <Slider
          min={0.5}
          max={10}
          step={0.5}
          value={[duration]}
          onValueChange={(v) => setDuration(v[0])}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-12 text-right">
          {duration.toFixed(1)} s
        </span>
      </div>

      {/* 진행 상황 */}
      {trajectoryState && trajectoryState.status !== "idle" && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {trajectoryState.status === "running" && "직선 이동 중…"}
              {trajectoryState.status === "done" && "완료"}
              {trajectoryState.status === "failed" && "IK 실패 — 경로 중단"}
              {trajectoryState.status === "stopped" && "중단됨"}
            </span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* 에러 */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* 버튼 */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleSync}
          disabled={syncing || isRunning}
        >
          {syncing ? "읽는 중…" : "TCP 동기화"}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleExecute}
          disabled={loading || isRunning}
        >
          {loading ? "전송 중…" : "실행"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onStop}
          disabled={!isRunning}
        >
          Stop
        </Button>
      </div>
    </div>
  );
}
