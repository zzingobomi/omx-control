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
import type { TCPPose, OrbitRotateRequest } from "@/types/motion";

const STEP_DEG = 5; // 한 번 누를 때 이동 각도

interface OrbitControlProps {
  tcpPose: TCPPose | null;
  orbitActive: boolean;
  compact?: boolean;
  onOrbitSet: () => Promise<boolean>;
  onOrbitRotate: (req: OrbitRotateRequest) => Promise<boolean>;
  onOrbitClear: () => Promise<void>;
}

// TODO: 현재 버그 있음 (사용 X)
export function OrbitControl({
  tcpPose,
  orbitActive,
  compact = false,
  onOrbitSet,
  onOrbitRotate,
  onOrbitClear,
}: OrbitControlProps) {
  // 버튼 누르고 있을 때 반복 실행
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRepeat = useCallback(
    (req: OrbitRotateRequest) => {
      onOrbitRotate(req);
      intervalRef.current = setInterval(() => onOrbitRotate(req), 150);
    },
    [onOrbitRotate]
  );

  const stopRepeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopRepeat(), [stopRepeat]);

  // grid 포지션: null = 빈칸, "center" = crosshair, 나머지 = 방향 버튼
  type GridCell =
    | { type: "button"; icon: typeof ArrowUp; pitch: number; yaw: number }
    | { type: "center" }
    | { type: "empty" };

  const grid: GridCell[][] = [
    [
      { type: "empty" },
      { type: "button", icon: ArrowUp, pitch: STEP_DEG, yaw: 0 }, // elevation 증가 = TCP 위로
      { type: "empty" },
    ],
    [
      { type: "button", icon: ArrowLeft, pitch: 0, yaw: -STEP_DEG },
      { type: "center" },
      { type: "button", icon: ArrowRight, pitch: 0, yaw: STEP_DEG },
    ],
    [
      { type: "empty" },
      { type: "button", icon: ArrowDown, pitch: -STEP_DEG, yaw: 0 }, // elevation 감소 = TCP 아래로
      { type: "empty" },
    ],
  ];

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Orbit center를 설정하면 TCP가 그 주변을 공전합니다.
        </p>
      )}

      {/* Orbit center 설정/해제 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={orbitActive ? "secondary" : "default"}
          className="flex-1 gap-1"
          onClick={onOrbitSet}
          disabled={orbitActive}
        >
          <Crosshair className="h-3 w-3" />
          {orbitActive ? "Orbit 설정됨" : "Orbit 설정"}
        </Button>
        {orbitActive && (
          <Button size="sm" variant="outline" onClick={onOrbitClear}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Orbit center 위치 표시 */}
      {!compact && tcpPose && orbitActive && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
          Orbit: [{tcpPose.position.map((v) => v.toFixed(3)).join(", ")}]
        </div>
      )}

      {/* 방향 조작 패드 */}
      <div
        className={`grid grid-cols-3 gap-1 place-items-center ${
          !orbitActive && "opacity-40 pointer-events-none"
        }`}
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
