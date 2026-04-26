import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";
import type { MoveJRequest, TrajectoryState } from "@/types/motion";

// arm joints (gripper 제외)
const ARM_JOINTS = [
  { id: 1, name: "Joint 1", minDeg: -180, maxDeg: 180 },
  { id: 2, name: "Joint 2", minDeg: -90, maxDeg: 90 },
  { id: 3, name: "Joint 3", minDeg: -90, maxDeg: 90 },
  { id: 4, name: "Joint 4", minDeg: -90, maxDeg: 90 },
  { id: 5, name: "Joint 5", minDeg: -180, maxDeg: 180 },
] as const;

const RAW_CENTER = 2048;
const RAW_MAX = 4095;

function degToRaw(deg: number): number {
  return Math.round((deg / 360.0) * RAW_MAX + RAW_CENTER);
}

function rawToDeg(raw: number): number {
  return Math.round(((raw - RAW_CENTER) / RAW_MAX) * 360.0 * 10) / 10;
}

interface JointState {
  id: number;
  position: number; // raw
  degree: number;
}

interface Props {
  trajectoryState: TrajectoryState | null;
  onMoveJ: (req: MoveJRequest) => Promise<boolean>;
  onStop: () => Promise<void>;
}

export function MoveJControl({ trajectoryState, onMoveJ, onStop }: Props) {
  // 현재 관절 상태 (joint state 토픽에서 수신)
  const [currentJoints, setCurrentJoints] = useState<JointState[]>([]);

  // 목표 각도 (degrees) — 초기값은 0도
  const [targetDeg, setTargetDeg] = useState<Record<number, number>>(
    Object.fromEntries(ARM_JOINTS.map((j) => [j.id, 0]))
  );

  const [duration, setDuration] = useState(3.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MOTOR_STATE_JOINT 구독 → 현재 관절 각도 반영
  useEffect(() => {
    const unsub = bridge.subscribe("omx/motor/state/joint", (data: unknown) => {
      const d = data as {
        joints: Array<{ id: number; position: number; degree: number }>;
      };
      const armJoints = d.joints.filter((j) => j.id >= 1 && j.id <= 5);
      setCurrentJoints(
        armJoints.map((j) => ({
          id: j.id,
          position: j.position,
          degree: j.degree,
        }))
      );
    });
    return () => unsub();
  }, []);

  // 현재 관절 각도를 목표값으로 복사
  const copyCurrentAngles = useCallback(() => {
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
      position: degToRaw(targetDeg[j.id] ?? 0),
    }));
    const ok = await onMoveJ({ joints, duration });
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
          const clipped = Math.max(j.minDeg, Math.min(j.maxDeg, target));
          return (
            <div
              key={j.id}
              className="grid grid-cols-[80px_1fr_72px] items-center gap-2"
            >
              <div>
                <Label className="text-xs font-medium">{j.name}</Label>
                {current && (
                  <p className="text-[10px] text-muted-foreground">
                    현재 {current.degree.toFixed(1)}°
                  </p>
                )}
              </div>
              <Slider
                min={j.minDeg}
                max={j.maxDeg}
                step={0.5}
                value={[clipped]}
                onValueChange={(v) => handleSliderChange(j.id, v)}
                className="w-full"
              />
              <div className="flex items-center gap-0.5">
                <Input
                  type="number"
                  value={target}
                  min={j.minDeg}
                  max={j.maxDeg}
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
          onClick={copyCurrentAngles}
          disabled={currentJoints.length === 0}
        >
          현재 복사
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
