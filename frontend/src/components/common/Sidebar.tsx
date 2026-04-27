import { NavLink } from "react-router-dom";
import {
  Gamepad2,
  Camera,
  Cpu,
  Bot,
  Settings,
  Box,
  Home,
  Power,
} from "lucide-react";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { cn } from "@/lib/utils";
import { useJointControl } from "@/hooks/useJointControl";

const navItems = [
  { to: "/", label: "Dashboard", icon: Gamepad2 },
  { to: "/motion", label: "Motion", icon: Cpu },
  { to: "/calibration", label: "Calibration", icon: Camera },
  { to: "/workspace", label: "Workspace3D", icon: Box },
  { to: "/ai", label: "AI", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { goHome, torqueEnabled, enableTorque } = useJointControl();

  return (
    <aside className="flex h-screen w-52 flex-col border-r bg-background">
      {/* 로고 */}
      <div className="px-4 py-5 border-b">
        <h1 className="text-lg font-semibold tracking-tight">OMX Control</h1>
        <p className="text-xs text-muted-foreground">Robot Arm Controller</p>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 전역 로봇 컨트롤 */}
      <div className="px-2 py-3 space-y-2 border-t">
        <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Control
        </p>
        <button
          onClick={goHome}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Home className="h-4 w-4" />
          Go Home
        </button>
        <button
          onClick={() => enableTorque(!torqueEnabled)}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            torqueEnabled
              ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
              : "bg-red-500/20 text-red-600 font-medium hover:bg-red-500/30",
          )}
        >
          <Power className="h-4 w-4" />
          {torqueEnabled ? "Torque ON" : "Torque OFF"}
        </button>
      </div>

      {/* 연결 상태 */}
      <div className="border-t">
        <p className="px-3 pt-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Status
        </p>
        <ConnectionStatus />
      </div>
    </aside>
  );
}
