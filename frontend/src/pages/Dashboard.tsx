import { JointPanel } from "@/components/robot/JointPanel";
import { RobotStatus } from "@/components/robot/RobotStatus";
import { CameraFeed } from "@/components/camera/CameraFeed";

export function Dashboard() {
  return (
    <div className="flex h-full gap-4 p-4">
      {/* 왼쪽: Joint 제어 */}
      <div className="flex w-80 shrink-0 flex-col gap-4">
        <div className="rounded-lg border bg-card p-4 flex-1">
          <JointPanel />
        </div>
        <RobotStatus />
      </div>
      {/* 오른쪽: 카메라 */}
      <div className="flex-1">
        <CameraFeed className="max-h-[720px]" />
      </div>
    </div>
  );
}
