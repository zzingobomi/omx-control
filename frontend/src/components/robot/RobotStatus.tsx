import { useRobotStore } from "@/store/robotStore";
import { rawToDeg } from "@/lib/robot/utils";

export function RobotStatus() {
  const joints = useRobotStore((s) => s.joints);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Joint Status
      </h2>
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        {/* 헤더 */}
        <span className="text-muted-foreground">Name</span>
        <span className="text-muted-foreground text-right">Degree</span>
        <span className="text-muted-foreground text-right">Raw</span>

        {/* 데이터 */}
        {joints.map((j) => (
          <>
            <span key={`name-${j.id}`} className="truncate">
              {j.name}
            </span>
            <span key={`deg-${j.id}`} className="text-right">
              {rawToDeg(j.position)}°
            </span>
            <span
              key={`raw-${j.id}`}
              className="text-right text-muted-foreground"
            >
              {j.position}
            </span>
          </>
        ))}
      </div>
    </div>
  );
}
