import { useStore } from "../lib/store";
import { cvCommands } from "../lib/cv-bridge";
import { useEffect } from "react";
import { formatDuration } from "../lib/utils";
import { Flame, Zap, TrendingUp, CheckCircle } from "lucide-react";

function StatCard({ label, value, sub, icon: Icon, color = "text-white" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-muted font-semibold uppercase tracking-wider">{label}</span>
        <Icon size={15} className={color} />
      </div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-surface-muted">{sub}</div>}
    </div>
  );
}

const ALL_ACHIEVEMENTS = [
  { id: "straight_spine", name: "Straight Spine",   icon: "🦴", desc: "10 min good posture" },
  { id: "focus_monk",     name: "Focus Monk",        icon: "🧘", desc: "30 min, <3 warnings" },
  { id: "hands_off",      name: "Hands Off",         icon: "✋", desc: "20 min no face alerts" },
  { id: "consistency_1",  name: "Consistency I",     icon: "📅", desc: "3 sessions in one day" },
  { id: "xp_100",         name: "XP Rookie",         icon: "⭐", desc: "100 total XP" },
  { id: "xp_500",         name: "XP Hunter",         icon: "🌟", desc: "500 total XP" },
  { id: "xp_1000",        name: "XP Legend",         icon: "💫", desc: "1000 total XP" },
  { id: "level_5",        name: "Level 5",           icon: "🔥", desc: "Reach level 5" },
];

export default function DashboardPage() {
  const { state } = useStore();
  const stats = state.stats;

  useEffect(() => {
    cvCommands.getStats();
  }, []);

  const global  = stats?.global;
  const today   = stats?.today;
  const week    = stats?.week ?? [];
  const unlocked = global?.achievements ?? [];

  const maxXp = Math.max(...week.map(d => d.xp), 1);

  return (
    <div className="p-6 flex flex-col gap-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
        <p className="text-sm text-surface-muted mt-0.5">Your progress at a glance</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total XP"       value={global?.total_xp ?? 0}             icon={Zap}       color="text-xp" />
        <StatCard label="Level"          value={global?.level ?? 1}                 icon={TrendingUp} color="text-brand-400" />
        <StatCard label="Posture Streak" value={`${global?.posture_streak_days ?? 0}d`} icon={Flame} color="text-warning" sub="consecutive days" />
        <StatCard label="Clean Streak"   value={`${global?.hf_streak_days ?? 0}d`} icon={Flame}     color="text-brand-400" sub="no face-touch days" />
      </div>

      {/* Today summary */}
      <div className="card">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-4">Today</div>
        <div className="grid grid-cols-5 gap-4 text-center">
          {[
            { label: "Sessions",         value: today?.sessions ?? 0 },
            { label: "XP Earned",        value: today?.total_xp ?? 0 },
            { label: "Good Posture",     value: formatDuration(today?.good_posture_s ?? 0) },
            { label: "Posture Warnings", value: today?.posture_warnings ?? 0 },
            { label: "Hand Warnings",    value: today?.hf_warnings ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1">
              <div className="text-xl font-extrabold text-white">{value}</div>
              <div className="text-xs text-surface-muted">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 7-day XP chart (simple bars) */}
      <div className="card">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-4">7-Day XP</div>
        <div className="flex items-end gap-2 h-28">
          {week.map((day) => {
            const barH = Math.max(4, (day.xp / maxXp) * 100);
            const label = new Date(day.date).toLocaleDateString([], { weekday: "short" });
            const isToday = day.date === new Date().toISOString().split("T")[0];
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: 96 }}>
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${isToday ? "bg-xp" : "bg-surface-border"}`}
                    style={{ height: `${barH}%` }}
                    title={`${day.xp} XP`}
                  />
                </div>
                <span className={`text-[10px] ${isToday ? "text-xp font-semibold" : "text-surface-muted"}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievements */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Achievements</div>
          <div className="text-xs text-surface-muted">{unlocked.length} / {ALL_ACHIEVEMENTS.length}</div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {ALL_ACHIEVEMENTS.map((a) => {
            const earned = unlocked.includes(a.id);
            return (
              <div
                key={a.id}
                className={`rounded-xl p-3 flex flex-col items-center gap-1.5 text-center border transition-all ${
                  earned
                    ? "bg-xp/10 border-xp/30"
                    : "bg-surface-border/20 border-surface-border opacity-40"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className={`text-xs font-semibold ${earned ? "text-white" : "text-surface-muted"}`}>{a.name}</span>
                <span className="text-[10px] text-surface-muted">{a.desc}</span>
                {earned && <CheckCircle size={12} className="text-xp" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
