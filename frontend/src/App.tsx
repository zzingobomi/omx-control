import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/common/Sidebar";
import { useBridge } from "@/hooks/useBridge";
import { Dashboard } from "@/pages/Dashboard";
import { Motion } from "@/pages/Motion";
import { Settings } from "@/pages/Settings";
import { Calibration } from "@/pages/Calibration";

function AppContent() {
  useBridge();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/motion" element={<Motion />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/calibration" element={<Calibration />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
