import { useCallback, useState } from "react";
import { useJointControl } from "@/hooks/useJointControl";
import { useRobotStore } from "@/store/robotStore";
import { JointSlider } from "@/components/robot/JointSlider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function JointPanel() {
  const joints = useRobotStore((s) => s.joints);
  const configs = useRobotStore((s) => s.configs);
  const { sendJointCmd, goHome, torqueEnabled, enableTorque } =
    useJointControl();

  const [cmdPositions, setCmdPositions] = useState<Record<number, number>>({});

  const getCmdPosition = (joint: { id: number; position: number }) =>
    cmdPositions[joint.id] ?? joint.position;

  const handleJointCmd = useCallback(
    (id: number, position: number) => {
      setCmdPositions((prev) => ({ ...prev, [id]: position }));
      sendJointCmd(id, position);
    },
    [sendJointCmd]
  );

  const syncAll = useCallback(() => {
    const synced = Object.fromEntries(joints.map((j) => [j.id, j.position]));
    setCmdPositions(synced);
  }, [joints]);

  const getLimit = (id: number) => {
    const cfg = configs.find((c) => c.id === id);
    return { min: cfg?.limit.min ?? 0, max: cfg?.limit.max ?? 4095 };
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Joint Control
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={goHome}>
            Home
          </Button>
          <Button size="sm" variant="outline" onClick={syncAll}>
            Sync
          </Button>
          <Button
            size="sm"
            variant={torqueEnabled ? "destructive" : "default"}
            onClick={() => enableTorque(!torqueEnabled)}
          >
            {torqueEnabled ? "Torque OFF" : "Torque ON"}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col divide-y">
        {joints.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            모터 연결 대기 중...
          </p>
        ) : (
          joints.map((joint) => {
            const { min, max } = getLimit(joint.id);
            return (
              <JointSlider
                key={joint.id}
                joint={joint}
                cmdPosition={getCmdPosition(joint)}
                limitMin={min}
                limitMax={max}
                onValueChange={handleJointCmd}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
