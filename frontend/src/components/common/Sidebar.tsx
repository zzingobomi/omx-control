import { NavLink } from "react-router-dom";
import { Gamepad2, Camera, Cpu, Bot, Settings } from "lucide-react";
import { ConnectionStatus } from "@/components/common/ConnectionStatus";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: Gamepad2 },
  { to: "/calibration", label: "Calibration", icon: Camera },
  { to: "/motion", label: "Motion", icon: Cpu },
  { to: "/ai", label: "AI", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
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
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

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
