import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JointPanel } from "@/components/robot/JointPanel";
import { MoveTCPControl } from "@/components/robot/MoveTCPControl";
import { MoveJControl } from "@/components/robot/MoveJControl";
import { MoveLControl } from "@/components/robot/MoveLControl";
import { useMotion } from "@/hooks/useMotion";

export function Motion() {
  const motion = useMotion();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="joint" className="flex flex-col flex-1 gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="joint">Joint</TabsTrigger>
          <TabsTrigger value="move_j">MoveJ</TabsTrigger>
          <TabsTrigger value="move_l">MoveL</TabsTrigger>
          <TabsTrigger value="move_tcp">Move TCP</TabsTrigger>
        </TabsList>

        {/* ── Joint 모드 (기존) ────────────────────────────────── */}
        <TabsContent value="joint" className="flex-1 m-0">
          <JointPanel />
        </TabsContent>

        {/* ── MoveJ ────────────────────────────────────────────── */}
        <TabsContent value="move_j" className="m-0">
          <div className="w-[480px] rounded-lg border bg-card p-4 flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">MoveJ</h2>
              <p className="text-xs text-muted-foreground mt-0.5">MoveJ</p>
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

        {/* ── MoveL ────────────────────────────────────────────── */}
        <TabsContent value="move_l" className="m-0">
          <div className="w-[480px] rounded-lg border bg-card p-4 flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">MoveL</h2>
              <p className="text-xs text-muted-foreground mt-0.5">MoveL</p>
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

        {/* ── Move TCP (기존 step 방식) ─────────────────────────── */}
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
