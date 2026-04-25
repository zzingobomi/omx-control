import { useCallback, useEffect, useState } from "react";
import { ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TCPPose, MoveTCPRequest, Vec3 } from "@/types/motion";

const STEPS = [0.001, 0.005, 0.01] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  0.001: "1mm",
  0.005: "5mm",
  0.01: "10mm",
};

const AXES = ["x", "y", "z"] as const;
type Axis = (typeof AXES)[number];
const AXIS_INDEX: Record<Axis, number> = { x: 0, y: 1, z: 2 };

interface MoveTCPControlProps {
  tcpPose: TCPPose | null;
  loading: boolean;
  compact?: boolean;
  onMoveTCP: (req: MoveTCPRequest) => Promise<boolean>;
  onGetTCP: () => Promise<void>;
}

export function MoveTCPControl({
  tcpPose,
  loading,
  compact = false,
  onMoveTCP,
  onGetTCP,
}: MoveTCPControlProps) {
  const [step, setStep] = useState<Step>(0.005);
  const [pos, setPos] = useState<Vec3>([0, 0, 0]);

  useEffect(() => {
    if (tcpPose) {
      // NOTE:
      // tcpPose는 서버에서 내려오는 "authoritative state"이고,
      // pos는 UI에서 사용하는 로컬 상태 (optimistic update + rollback)이다.
      //
      // 따라서 이 effect는 "계산된 값 동기화"가 아니라
      // "외부 시스템(서버 상태) → React state 동기화" 역할을 한다.
      //
      // React 권장사항에서도 외부 상태를 반영하는 경우의 setState는 정상적인 패턴이며,
      // 이 컴포넌트에서는 의도적으로 사용된 구조다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPos([...tcpPose.position]);
    }
  }, [tcpPose]);

  const handleSync = useCallback(async () => {
    await onGetTCP();
  }, [onGetTCP]);

  const doStep = useCallback(
    async (axis: Axis, direction: 1 | -1) => {
      const prev = pos;
      const next: Vec3 = [...pos];
      next[AXIS_INDEX[axis]] += step * direction;
      setPos(next);

      const success = await onMoveTCP({ position: next });
      if (!success) {
        setPos(prev);
      }
    },
    [pos, step, onMoveTCP]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Step 선택 */}
      <div className="flex gap-1">
        {STEPS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={step === s ? "default" : "outline"}
            className="flex-1 text-xs h-7"
            onClick={() => setStep(s)}
          >
            {STEP_LABELS[s]}
          </Button>
        ))}
      </div>

      {/* 축별 컨트롤 */}
      <div className="flex flex-col gap-1">
        {AXES.map((axis, i) => (
          <div key={axis} className="flex items-center gap-2">
            <span className="w-4 text-xs font-mono text-muted-foreground uppercase">
              {axis}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => doStep(axis, -1)}
              disabled={!tcpPose || loading}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>

            <span className="flex-1 text-center font-mono text-xs tabular-nums">
              {(pos[i] * 1000).toFixed(1)} mm
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => doStep(axis, 1)}
              disabled={!tcpPose || loading}
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={handleSync}
        disabled={loading}
      >
        <RefreshCw className="h-3 w-3" />
        현재 위치 동기화
      </Button>
    </div>
  );
}
