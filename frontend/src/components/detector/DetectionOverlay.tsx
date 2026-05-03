import { useRef, useEffect } from "react";
import { useDetectorStore } from "@/store/detectorStore";
import type { Detection } from "@/store/detectorStore";

const CLASS_COLORS: Record<string, string> = {
  cup: "#34d399",
  bottle: "#60a5fa",
  fork: "#f59e0b",
  knife: "#f87171",
  spoon: "#a78bfa",
  remote: "#fb923c",
};

const DEFAULT_COLOR = "#e2e8f0";

interface Props {
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
}

export function DetectionOverlay({
  frameWidth,
  frameHeight,
  displayWidth,
  displayHeight,
}: Props) {
  const detections = useDetectorStore((s) => s.detections);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scaleX = displayWidth / frameWidth;
  const scaleY = displayHeight / frameHeight;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach((det: Detection) => {
      const [x1, y1, x2, y2] = det.bbox;
      const sx = x1 * scaleX;
      const sy = y1 * scaleY;
      const sw = (x2 - x1) * scaleX;
      const sh = (y2 - y1) * scaleY;

      const color = CLASS_COLORS[det.class] ?? DEFAULT_COLOR;

      // bbox
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);

      // 라벨 배경
      const label = `${det.class} ${(det.conf * 100).toFixed(0)}%`;
      ctx.font = "bold 12px monospace";
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy - 18, textW + 8, 18);

      // 라벨 텍스트
      ctx.fillStyle = "#000";
      ctx.fillText(label, sx + 4, sy - 4);
    });
  }, [detections, scaleX, scaleY]);

  return (
    <canvas
      ref={canvasRef}
      width={displayWidth}
      height={displayHeight}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
