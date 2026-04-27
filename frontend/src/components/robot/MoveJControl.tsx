import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { bridge } from "@/api/bridge";
import type { MoveJRequest, TrajectoryState } from "@/types/motion";
import { degToRaw, rawToDeg } from "@/lib/robot/utils";
import { ARM_JOINTS } from "@/lib/robot/config";
import { useRobotStore } from "@/store/robotStore";

interface Props {
  trajectoryState: TrajectoryState | null;
  onMoveJ: (req: MoveJRequest) => Promise<boolean>;
  onStop: () => Promise<void>;
}

export function MoveJControl({ trajectoryState, onMoveJ, onStop }: Props) {
  const joints = useRobotStore((s) => s.joints);
  const configs = useRobotStore((s) => s.configs);
  const armIds = new Set(ARM_JOINTS.map((j) => j.id));
  const currentJoints = joints.filter((j) => armIds.has(j.id));

  // UI 설정
  const [targetDeg, setTargetDeg] = useState<Record<number, number>>(
    Object.fromEntries(ARM_JOINTS.map((j) => [j.id, 0]))
  );
  const [duration, setDuration] = useState(3.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCurrentJointAngles = useCallback(() => {
    if (currentJoints.length === 0) return;

    const next: Record<number, number> = { ...targetDeg };

    currentJoints.forEach((j) => {
      next[j.id] = Math.round(j.degree * 10) / 10;
    });

    setTargetDeg(next);
  }, [currentJoints, targetDeg]);

  const handleDegChange = (id: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setTargetDeg((prev) => ({ ...prev, [id]: num }));
    }
  };

  const handleSliderChange = (id: number, value: number[]) => {
    setTargetDeg((prev) => ({ ...prev, [id]: value[0] }));
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);

    const joints = ARM_JOINTS.map((j) => ({
      id: j.id,
      degree: targetDeg[j.id] ?? 0,
    }));
    const ok = await onMoveJ({ joints });

    if (!ok) setError("MoveJ 실패");

    setLoading(false);
  };

  const isRunning = trajectoryState?.status === "running";
  const progress = Math.round((trajectoryState?.progress ?? 0) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* 관절 입력 */}
      <div className="flex flex-col gap-3">
        {ARM_JOINTS.map((j) => {
          const current = currentJoints.find((c) => c.id === j.id);
          const target = targetDeg[j.id] ?? 0;

          const hw = configs.find((c) => c.id === j.id);

          const minDeg = rawToDeg(hw?.limit.min ?? 0);
          const maxDeg = rawToDeg(hw?.limit.max ?? 4095);

          const clipped = Math.max(minDeg, Math.min(maxDeg, target));

          return (
            <div
              key={j.id}
              className="grid grid-cols-[80px_1fr_72px] items-center gap-2"
            >
              <div>
                <Label className="text-xs font-medium">{j.label}</Label>
                {current && (
                  <p className="text-[10px] text-muted-foreground">
                    현재 {current.degree.toFixed(1)}°
                  </p>
                )}
              </div>

              <Slider
                min={minDeg}
                max={maxDeg}
                step={0.5}
                value={[clipped]}
                onValueChange={(v) => handleSliderChange(j.id, v)}
                className="w-full"
              />

              <div className="flex items-center gap-0.5">
                <Input
                  type="number"
                  value={target}
                  min={minDeg}
                  max={maxDeg}
                  step={0.5}
                  onChange={(e) => handleDegChange(j.id, e.target.value)}
                  className="h-7 w-full px-1.5 text-xs text-right"
                />
                <span className="text-xs text-muted-foreground">°</span>
              </div>
            </div>
          );
        })}
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
              {trajectoryState.status === "running" && "실행 중…"}
              {trajectoryState.status === "done" && "완료"}
              {trajectoryState.status === "failed" && "IK 실패"}
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
          onClick={applyCurrentJointAngles}
          disabled={currentJoints.length === 0}
        >
          현재 자세 불러오기
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
