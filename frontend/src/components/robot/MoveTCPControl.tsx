import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TCPPose, MoveTCPRequest } from "@/types/motion";

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
  const [pos, setPos] = useState({ x: "0.000", y: "0.000", z: "0.000" });

  const handleSync = async () => {
    await onGetTCP();
    if (tcpPose) {
      setPos({
        x: tcpPose.position[0].toFixed(3),
        y: tcpPose.position[1].toFixed(3),
        z: tcpPose.position[2].toFixed(3),
      });
    }
  };

  const handleMove = async () => {
    await onMoveTCP({
      position: [parseFloat(pos.x), parseFloat(pos.y), parseFloat(pos.z)],
      quaternion: null,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!compact && (
        <p className="text-xs text-muted-foreground">
          TCP 목표 위치를 입력하거나 현재 위치를 동기화하세요. (단위: m)
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} className="flex flex-col gap-1">
            <Label className="text-xs uppercase text-muted-foreground">
              {axis}
            </Label>
            <Input
              className="font-mono text-sm h-8"
              value={pos[axis]}
              onChange={(e) =>
                setPos((p) => ({ ...p, [axis]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      {!compact && tcpPose && (
        <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono text-muted-foreground">
          현재: [{tcpPose.position.map((v) => v.toFixed(3)).join(", ")}]
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleSync}
        >
          Sync
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleMove}
          disabled={loading}
        >
          {loading ? "이동 중..." : "Move"}
        </Button>
      </div>
    </div>
  );
}
