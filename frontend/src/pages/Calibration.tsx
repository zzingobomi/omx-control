import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">IntrinsicTab</div>
    </div>
  );
}

// ─── Hand-Eye 탭 ─────────────────────────────────────────────

function HandEyeTab() {
  return (
    <div className="flex h-full gap-4">
      <div className="flex-1">HandEyeTab</div>
    </div>
  );
}
