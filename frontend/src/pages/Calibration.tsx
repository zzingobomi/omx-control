import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CameraFeed } from "@/components/camera/CameraFeed";
import { bridge } from "@/api/bridge";
import { ServiceKey } from "@/constants/topics";

export function Calibration() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Tabs defaultValue="intrinsic" className="flex flex-col flex-1 gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="intrinsic">Intrinsic</TabsTrigger>
          <TabsTrigger value="handeye">Hand-Eye</TabsTrigger>
        </TabsList>

        <TabsContent value="intrinsic" className="flex-1 m-0">
          <IntrinsicTab />
        </TabsContent>

        <TabsContent value="handeye" className="flex-1 m-0">
          <HandEyeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Intrinsic 탭 ────────────────────────────────────────────

function IntrinsicTab() {
  const [captureCount, setCaptureCount] = useState(0);
  const [rmsError, setRmsError] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    await bridge.callService(ServiceKey.CALIB_INTRINSIC_START, {});
    setCaptureCount(0);
    setRmsError(null);
    setPreview(null);
    setStatus("캘리브레이션 초기화됨. 체커보드를 카메라 앞에 놓고 캡처하세요.");
  };

  const handleCapture = async () => {
    setLoading(true);
    const res = await bridge.callService(ServiceKey.CALIB_CAPTURE, {
      mode: "intrinsic",
    });
    setLoading(false);
    if (res.success) {
      const data = res.data as {
        detected: boolean;
        captured_count: number;
        preview: string;
      };
      setCaptureCount(data.captured_count);
      setStatus(
        data.detected
          ? `✅ 감지 성공 (${data.captured_count}장)`
          : "❌ 체커보드 미감지",
      );
      if (data.preview) setPreview(data.preview);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const res = await bridge.callService(ServiceKey.CALIB_INTRINSIC_SAVE, {});
    setLoading(false);
    if (res.success) {
      const data = res.data as { rms_error: number };
      setRmsError(data.rms_error);
      setStatus(`✅ 저장 완료 (RMS: ${data.rms_error.toFixed(4)})`);
    } else {
      setStatus(`❌ 실패: ${res.message}`);
    }
  };

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">
        <CameraFeed
          className="h-2/3 w-full"
          overlay={
            preview ? (
              <img
                src={`data:image/jpeg;base64,${preview}`}
                className="h-full w-full object-contain"
                alt="preview"
              />
            ) : undefined
          }
        />
      </div>

      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Intrinsic Calibration</h2>
          <p className="text-xs text-muted-foreground">
            체커보드를 다양한 각도에서 최소 10장 이상 캡처하세요.
          </p>

          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={handleStart}>
              초기화
            </Button>
            <Button size="sm" onClick={handleCapture} disabled={loading}>
              {loading ? "처리 중..." : "캡처"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={captureCount < 5 || loading}
            >
              캘리브레이션 & 저장
            </Button>
          </div>

          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">캡처 수</span>
              <span className="font-mono">{captureCount}장</span>
            </div>
            {rmsError !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">RMS Error</span>
                <span className="font-mono">{rmsError.toFixed(4)}</span>
              </div>
            )}
          </div>

          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Hand-Eye 탭 ─────────────────────────────────────────────

function HandEyeTab() {
  const [poseCount, setPoseCount] = useState(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRecordPose = async () => {
    setLoading(true);
    // TODO: 현재는 단위 행렬 사용 (실제로는 FK 결과를 넘겨야 함)
    const R = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const t = [0, 0, 0];
    const res = await bridge.callService(ServiceKey.CALIB_HANDEYE_START, {
      R,
      t,
    });
    setLoading(false);
    if (res.success) {
      const data = res.data as { pose_count: number };
      setPoseCount(data.pose_count);
      setStatus(`✅ 포즈 기록됨 (${data.pose_count}개)`);
    } else {
      setStatus(`❌ ${res.message}`);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const res = await bridge.callService(ServiceKey.CALIB_HANDEYE_SAVE, {});
    setLoading(false);
    setStatus(res.success ? `✅ 저장 완료` : `❌ ${res.message}`);
  };

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">
        <CameraFeed className="h-2/3 w-full" />
      </div>

      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Hand-Eye Calibration</h2>
          <p className="text-xs text-muted-foreground">
            로봇을 다양한 자세로 이동 후 포즈를 기록하세요. 최소 3개 필요.
          </p>

          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={handleRecordPose} disabled={loading}>
              {loading ? "처리 중..." : "포즈 기록"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={poseCount < 3 || loading}
            >
              캘리브레이션 & 저장
            </Button>
          </div>

          <div className="rounded-md bg-muted p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">기록된 포즈</span>
              <span className="font-mono">{poseCount}개</span>
            </div>
          </div>

          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      </div>
    </div>
  );
}
