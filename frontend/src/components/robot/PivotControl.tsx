import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  X,
} from "lucide-react";
import type { TCPPose, PivotRotateRequest } from "@/types/motion";

const STEP_DEG = 5; // 한 번 누를 때 이동 각도

interface PivotControlProps {
  tcpPose: TCPPose | null;
  pivotActive: boolean;
  compact?: boolean;
  onPivotSet: () => Promise<boolean>;
  onPivotRotate: (req: PivotRotateRequest) => Promise<boolean>;
  onPivotClear: () => Promise<void>;
}

export function PivotControl({
  tcpPose,
  pivotActive,
  compact = false,
  onPivotSet,
  onPivotRotate,
  onPivotClear,
}: PivotControlProps) {
  // 버튼 누르고 있을 때 반복 실행
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRepeat = useCallback(
    (req: PivotRotateRequest) => {
      onPivotRotate(req);
      intervalRef.current = setInterval(() => onPivotRotate(req), 150);
    },
    [onPivotRotate],
  );

  const stopRepeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  type GridCell =
    | { type: "button"; icon: typeof ArrowUp; pitch: number; yaw: number }
    | { type: "center" }
    | { type: "empty" };

  const grid: GridCell[][] = [
    [
      { type: "empty" },
      { type: "button", icon: ArrowUp, pitch: -STEP_DEG, yaw: 0 },
      { type: "empty" },
    ],
    [
      { type: "button", icon: ArrowLeft, pitch: 0, yaw: -STEP_DEG },
      { type: "center" },
      { type: "button", icon: ArrowRight, pitch: 0, yaw: STEP_DEG },
    ],
    [
      { type: "empty" },
      { type: "button", icon: ArrowDown, pitch: STEP_DEG, yaw: 0 },
      { type: "empty" },
    ],
  ];

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          현재 TCP 위치를 pivot point로 고정하고 방향을 조작하세요.
        </p>
      )}

      {/* Pivot point 설정/해제 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={pivotActive ? "secondary" : "default"}
          className="flex-1 gap-1"
          onClick={onPivotSet}
          disabled={pivotActive}
        >
          <Crosshair className="h-3 w-3" />
          {pivotActive ? "Pivot 설정됨" : "Pivot 설정"}
        </Button>
        {pivotActive && (
          <Button size="sm" variant="outline" onClick={onPivotClear}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Pivot point 위치 표시 */}
      {!compact && tcpPose && pivotActive && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
          Pivot: [{tcpPose.position.map((v) => v.toFixed(3)).join(", ")}]
        </div>
      )}

      {/* 방향 조작 패드 */}
      <div
        className={`grid grid-cols-3 gap-1 place-items-center ${!pivotActive && "opacity-40 pointer-events-none"}`}
      >
        {grid.flat().map((cell, i) => {
          if (cell.type === "empty") return <div key={i} />;
          if (cell.type === "center")
            return (
              <div
                key={i}
                className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center"
              >
                <Crosshair className="h-4 w-4 text-muted-foreground" />
              </div>
            );
          const Icon = cell.icon;
          return (
            <Button
              key={i}
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0"
              onMouseDown={() =>
                startRepeat({ delta_pitch: cell.pitch, delta_yaw: cell.yaw })
              }
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
