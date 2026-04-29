import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JointPanel } from "@/components/robot/JointPanel";
import { MoveTCPControl } from "@/components/robot/MoveTCPControl";
import { MoveJControl } from "@/components/robot/MoveJControl";
import { MoveLControl } from "@/components/robot/MoveLControl";
import { MoveCControl } from "@/components/robot/MoveCControl";
import { MovePControl } from "@/components/robot/MovePControl";
import { useMotion } from "@/hooks/useMotion";

const CARD = "w-[480px] rounded-lg border bg-card p-4 flex flex-col gap-3";

export function Motion() {
  const motion = useMotion();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="joint" className="flex flex-col flex-1 gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="joint">Joint</TabsTrigger>
          <TabsTrigger value="move_j">MoveJ</TabsTrigger>
          <TabsTrigger value="move_l">MoveL</TabsTrigger>
          <TabsTrigger value="move_c">MoveC</TabsTrigger>
          <TabsTrigger value="move_p">MoveP</TabsTrigger>
          <TabsTrigger value="move_tcp">Move TCP</TabsTrigger>
        </TabsList>

        {/* ── Joint ───────────────────────────────────────────── */}
        <TabsContent value="joint" className="flex-1 m-0">
          <JointPanel />
        </TabsContent>

        {/* ── MoveJ ───────────────────────────────────────────── */}
        <TabsContent value="move_j" className="m-0">
          <div className={CARD}>
            <div>
              <h2 className="text-sm font-semibold">MoveJ</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                관절 공간 이동 — Ruckig jerk-limited, 전 관절 동기화
              </p>
            </div>
            <MoveJControl
              trajectoryState={motion.trajectoryState}
              onMoveJ={motion.moveJ}
              onStop={motion.stopMotion}
            />
            {motion.error && (
              <p className="text-xs text-destructive">{motion.error}</p>
            )}
          </div>
        </TabsContent>

        {/* ── MoveL ───────────────────────────────────────────── */}
        <TabsContent value="move_l" className="m-0">
          <div className={CARD}>
            <div>
              <h2 className="text-sm font-semibold">MoveL</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                TCP 직선 이동 — Ruckig 1D jerk-limited, 거리 기반 자동 속도
              </p>
            </div>
            <MoveLControl
              tcpPose={motion.tcpPose}
              trajectoryState={motion.trajectoryState}
              onGetTCP={motion.getTCP}
              onMoveL={motion.moveL}
              onStop={motion.stopMotion}
            />
            {motion.error && (
              <p className="text-xs text-destructive">{motion.error}</p>
            )}
          </div>
        </TabsContent>

        {/* ── MoveC ───────────────────────────────────────────── */}
        <TabsContent value="move_c" className="m-0">
          <div className={CARD}>
            <div>
              <h2 className="text-sm font-semibold">MoveC</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                TCP 원호 이동 — Start(현재) → Via → End, Ruckig arc-length
              </p>
            </div>
            <MoveCControl
              tcpPose={motion.tcpPose}
              trajectoryState={motion.trajectoryState}
              onGetTCP={motion.getTCP}
              onMoveC={motion.moveC}
              onStop={motion.stopMotion}
            />
            {motion.error && (
              <p className="text-xs text-destructive">{motion.error}</p>
            )}
          </div>
        </TabsContent>

        {/* ── MoveP ───────────────────────────────────────────── */}
        <TabsContent value="move_p" className="m-0">
          <div className={CARD}>
            <div>
              <h2 className="text-sm font-semibold">MoveP</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                다중 경유점 blending — CubicSpline G2 연속 + Ruckig jerk-limited
              </p>
            </div>
            <MovePControl
              tcpPose={motion.tcpPose}
              trajectoryState={motion.trajectoryState}
              onGetTCP={motion.getTCP}
              onMoveP={motion.moveP}
              onStop={motion.stopMotion}
            />
            {motion.error && (
              <p className="text-xs text-destructive">{motion.error}</p>
            )}
          </div>
        </TabsContent>

        {/* ── Move TCP (step 방식) ─────────────────────────────── */}
        <TabsContent value="move_tcp" className="m-0">
          <div className="w-80 rounded-lg border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Move TCP</h2>
            <MoveTCPControl
              tcpPose={motion.tcpPose}
              loading={motion.loading}
              onMoveTCP={motion.moveTCP}
              onGetTCP={motion.getTCP}
            />
            {motion.error && (
              <p className="text-xs text-destructive">{motion.error}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
