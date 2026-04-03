import { useStore } from "../lib/store";
import { cvCommands } from "../lib/cv-bridge";
import { PostureBadge, HandFaceBadge } from "../components/StatusBadge";
import { formatDuration, xpProgress } from "../lib/utils";
import {
  Play, Pause, Square, Crosshair, AlertTriangle, Activity,
  Flame, Zap, Clock
} from "lucide-react";

export default function MonitorPage() {
  const { state, dispatch } = useStore();
  const s = state;
  const stats = s.stats;
  const session = stats?.session;
  const global = stats?.global;

  const isRunning   = s.monitoringState === "running";
  const isPaused    = s.monitoringState === "paused";
  const isIdle      = s.monitoringState === "idle";
  const isCalib     = s.monitoringState === "calibrating";

  async function handleStart() {
    if (!s.calibrated && !global?.posture_streak_days) {
      // Prompt calibration on first launch
      await cvCommands.calibrateStart();
      dispatch({ type: "CALIBRATION_STARTED" });
    }
    await cvCommands.start();
  }

  async function handlePause() {
    if (isPaused) {
      await cvCommands.resume();
    } else {
      await cvCommands.pause();
    }
  }

  async function handleStop() {
    await cvCommands.stop();
  }

  async function handleCalibrate() {
    if (!isRunning && !isPaused) await cvCommands.start();
    await cvCommands.calibrateStart();
    dispatch({ type: "CALIBRATION_STARTED" });
  }

  const level  = global?.level ?? 1;
  const xpPct  = xpProgress(global?.total_xp ?? 0, level);
  const sessionXp = session?.session_xp ?? 0;

  return (
    <div className="p-6 flex flex-col gap-5 max-w-5xl mx-auto">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Monitor</h1>
          <p className="text-sm text-surface-muted mt-0.5">Real-time posture & habit tracking</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Calibrate */}
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={handleCalibrate}
            disabled={isCalib || !s.serviceReady}
            title="Calibrate good posture"
          >
            <Crosshair size={15} />
            Calibrate
          </button>

          {/* Stop */}
          {(isRunning || isPaused) && (
            <button className="btn-danger flex items-center gap-2 text-sm" onClick={handleStop}>
              <Square size={14} fill="currentColor" />
              Stop
            </button>
          )}

          {/* Pause / Resume */}
          {(isRunning || isPaused) && (
            <button className="btn-secondary flex items-center gap-2 text-sm" onClick={handlePause}>
              <Pause size={14} />
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}

          {/* Start */}
          {isIdle && (
            <button
              className="btn-primary flex items-center gap-2 text-sm"
              onClick={handleStart}
              disabled={!s.serviceReady}
            >
              <Play size={14} fill="currentColor" />
              Start Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Camera preview */}
        <div className="col-span-2 card flex flex-col gap-3 p-0 overflow-hidden">
          <div className="relative bg-black aspect-video flex items-center justify-center">
            {s.settings.camera_preview && s.currentFrame ? (
              <img
                src={`data:image/jpeg;base64,${s.currentFrame}`}
                className="w-full h-full object-cover"
                alt="Camera feed"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-surface-muted">
                <Activity size={32} />
                <span className="text-sm">
                  {isIdle ? "Start monitoring to see camera feed" : "Camera preview disabled"}
                </span>
              </div>
            )}

            {/* Status overlay badges */}
            {(isRunning || isPaused) && (
              <div className="absolute top-3 left-3 flex gap-2">
                <PostureBadge status={s.posture} />
                <HandFaceBadge status={s.handFace} />
              </div>
            )}

            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-white font-bold text-lg">Paused</span>
              </div>
            )}
          </div>

          {/* Session timer bar */}
          <div className="px-4 pb-4 flex items-center justify-between text-sm text-surface-muted">
            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>Session: {formatDuration(session?.duration_s ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={13} />
              <span>Good posture: {formatDuration(session?.good_posture_s ?? 0)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-warning">
              <AlertTriangle size={13} />
              <span>{session?.posture_warnings ?? 0} warnings</span>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* XP card */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Level</span>
              <span className="text-2xl font-extrabold text-white">{level}</span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-surface-muted mb-1">
                <span>{global?.total_xp ?? 0} XP</span>
                <span>{level * 200} XP</span>
              </div>
              <div className="h-2 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-xp rounded-full transition-all duration-700"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xp text-sm font-semibold">
              <Zap size={14} />
              <span>+{sessionXp} XP this session</span>
            </div>
          </div>

          {/* Streak cards */}
          <div className="card">
            <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-3">Streaks</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-border/30 rounded-xl p-3 text-center">
                <Flame size={18} className="text-warning mx-auto mb-1" />
                <div className="text-xl font-extrabold text-white">{global?.posture_streak_days ?? 0}</div>
                <div className="text-[10px] text-surface-muted">Posture days</div>
              </div>
              <div className="bg-surface-border/30 rounded-xl p-3 text-center">
                <Flame size={18} className="text-brand-400 mx-auto mb-1" />
                <div className="text-xl font-extrabold text-white">{global?.hf_streak_days ?? 0}</div>
                <div className="text-[10px] text-surface-muted">Clean days</div>
              </div>
            </div>
          </div>

          {/* Status detail */}
          <div className="card flex flex-col gap-2">
            <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Status</div>
            <div className="flex flex-col gap-2">
              <PostureBadge status={s.posture} label="Posture" />
              <HandFaceBadge status={s.handFace} />
            </div>
            {!s.calibrated && (
              <p className="text-[10px] text-warning mt-1">
                Not calibrated — using universal defaults. Click Calibrate for better accuracy.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Event feed */}
      <div className="card">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider mb-3">Event Feed</div>
        {s.alerts.length === 0 ? (
          <p className="text-xs text-surface-muted text-center py-4">No events yet — looking good!</p>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {s.alerts.map((a, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs ${
                  a.kind === "posture"
                    ? "bg-warning/10 text-warning"
                    : "bg-danger/10 text-danger"
                }`}
              >
                <AlertTriangle size={12} />
                <span className="flex-1">{a.msg}</span>
                <span className="opacity-50 font-mono shrink-0">
                  {new Date(a.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
