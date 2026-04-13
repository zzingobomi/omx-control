const CAMERA_URL = "http://localhost:8000/camera/stream";

export function CameraFeed() {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black">
      <img
        src={CAMERA_URL}
        alt="camera feed"
        className="w-full max-h-[480px] object-contain"
      />
    </div>
  );
}
