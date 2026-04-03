import { NavLink } from "react-router-dom";
import { Monitor, BarChart2, Settings } from "lucide-react";
import { useStore } from "../lib/store";
import Spino from "./Spino";

const links = [
  { to: "/monitor",   label: "Monitor",   icon: Monitor },
  { to: "/dashboard", label: "Dashboard", icon: BarChart2 },
  { to: "/settings",  label: "Settings",  icon: Settings },
];

export default function Sidebar() {
  const { state } = useStore();
  const level = state.stats?.global.level ?? 1;
  const totalXp = state.stats?.global.total_xp ?? 0;
  const xpPct = ((totalXp % 200) / 200) * 100;

  return (
    <aside className="w-56 flex flex-col bg-surface-card border-r border-surface-border py-5 px-3 gap-3 shrink-0">
      {/* Logo */}
      <div className="px-2 mb-2">
        <h1 className="text-xl font-extrabold text-white tracking-tight">
          Posture<span className="text-brand-400">XP</span>
        </h1>
        <p className="text-xs text-surface-muted mt-0.5">Your habit coach</p>
      </div>

      {/* Mascot */}
      <div className="flex flex-col items-center py-3 card gap-1">
        <Spino
          posture={state.posture}
          monitoring={state.monitoringState === "running"}
          size={72}
        />
        <div className="text-xs font-semibold text-white mt-1">Spino</div>
        <div className="text-[10px] text-surface-muted">Lv. {level}</div>
        {/* XP bar */}
        <div className="w-full h-1.5 bg-surface-border rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-xp rounded-full transition-all duration-700"
            style={{ width: `${xpPct}%` }}
          />
        </div>
        <div className="text-[10px] text-surface-muted">{totalXp} XP</div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2">
        <div className={`flex items-center gap-2 text-xs ${state.serviceReady ? "text-brand-400" : "text-surface-muted"}`}>
          <div className={`w-2 h-2 rounded-full ${state.serviceReady ? "bg-brand-400 animate-pulse" : "bg-surface-muted"}`} />
          {state.serviceReady ? "CV Service Ready" : "Starting..."}
        </div>
      </div>
    </aside>
  );
}
