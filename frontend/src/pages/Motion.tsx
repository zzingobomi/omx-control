import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JointPanel } from "@/components/robot/JointPanel";
import { MoveTCPControl } from "@/components/robot/MoveTCPControl";
import { PivotControl } from "@/components/robot/PivotControl";
import { useMotion } from "@/hooks/useMotion";

export function Motion() {
  const motion = useMotion();

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="joint" className="flex flex-col flex-1 gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="joint">Joint</TabsTrigger>
          <TabsTrigger value="move_tcp">Move TCP</TabsTrigger>
          <TabsTrigger value="pivot">Pivot</TabsTrigger>
        </TabsList>

        {/* Joint 모드 */}
        <TabsContent value="joint" className="flex-1 m-0">
          <JointPanel />
        </TabsContent>

        {/* Move TCP 모드 */}
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

        {/* Pivot 모드 */}
        <TabsContent value="pivot" className="m-0">
          <div className="w-80 rounded-lg border bg-card p-4 flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Pivot</h2>
            <PivotControl
              tcpPose={motion.tcpPose}
              pivotActive={motion.pivotActive}
              onPivotSet={motion.pivotSet}
              onPivotRotate={motion.pivotRotate}
              onPivotClear={motion.pivotClear}
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
