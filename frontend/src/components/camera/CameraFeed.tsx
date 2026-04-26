import { BASE_URL } from "@/constants";

const CAMERA_URL = `${BASE_URL}/camera/stream`;

interface Props {
  className?: string;
  overlay?: React.ReactNode;
}

export function CameraFeed({ className, overlay }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-black ${
        className ?? ""
      }`}
    >
      <img
        src={CAMERA_URL}
        alt="camera feed"
        className="w-full h-full object-contain"
      />
      {overlay && <div className="absolute inset-0">{overlay}</div>}
    </div>
  );
}
