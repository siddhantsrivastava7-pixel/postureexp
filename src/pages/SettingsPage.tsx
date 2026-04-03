import { useStore } from "../lib/store";
import { cvCommands } from "../lib/cv-bridge";
import type { AppSettings, Sensitivity } from "../types";

function SensitivityPicker({
  label, value, onChange,
}: { label: string; value: Sensitivity; onChange: (v: Sensitivity) => void }) {
  const options: Sensitivity[] = ["relaxed", "normal", "strict"];
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize border transition-all ${
              value === o
                ? "bg-brand-600 border-brand-500 text-white"
                : "border-surface-border text-surface-muted hover:text-white"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, desc }: {
  label: string; value: boolean; onChange: (v: boolean) => void; desc?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm text-white">{label}</div>
        {desc && <div className="text-xs text-surface-muted">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full border transition-all duration-200 ${
          value ? "bg-brand-600 border-brand-500" : "bg-surface-border border-surface-border"
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
            value ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function SliderSetting({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-32 accent-brand-500"
        />
        <span className="text-xs text-surface-muted w-12 text-right font-mono">
          {value}{unit ?? "s"}
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const settings = state.settings;

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    dispatch({ type: "SETTINGS_UPDATE", settings: { [key]: value } });
    cvCommands.updateSettings({ [key]: value });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Settings</h1>
        <p className="text-sm text-surface-muted mt-0.5">Customize detection and alerts</p>
      </div>

      {/* Detection */}
      <div className="card flex flex-col gap-4">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Detection</div>
        <SensitivityPicker
          label="Posture Sensitivity"
          value={settings.posture_sensitivity}
          onChange={(v) => update("posture_sensitivity", v)}
        />
        <SensitivityPicker
          label="Hand-Near-Face Sensitivity"
          value={settings.hand_face_sensitivity}
          onChange={(v) => update("hand_face_sensitivity", v)}
        />
        <div className="border-t border-surface-border pt-3 flex flex-col gap-3">
          <SliderSetting
            label="Posture warning after"
            value={settings.posture_persist_s}
            min={1} max={10} step={0.5}
            onChange={(v) => update("posture_persist_s", v)}
          />
          <SliderSetting
            label="Hand-face warning after"
            value={settings.hand_face_persist_s}
            min={0.5} max={5} step={0.5}
            onChange={(v) => update("hand_face_persist_s", v)}
          />
          <SliderSetting
            label="Cooldown between warnings"
            value={settings.cooldown_s}
            min={3} max={60} step={1}
            onChange={(v) => update("cooldown_s", v)}
          />
        </div>
      </div>

      {/* Alerts */}
      <div className="card flex flex-col gap-4">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Alerts</div>
        <Toggle
          label="Sound alerts"
          value={settings.sound_alerts}
          onChange={(v) => update("sound_alerts", v)}
          desc="Soft audio tones on warnings"
        />
        <Toggle
          label="Desktop notifications"
          value={settings.desktop_notify}
          onChange={(v) => update("desktop_notify", v)}
          desc="System notification on each alert"
        />
      </div>

      {/* Display */}
      <div className="card flex flex-col gap-4">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Display</div>
        <Toggle
          label="Camera preview"
          value={settings.camera_preview}
          onChange={(v) => update("camera_preview", v)}
          desc="Show live webcam feed on monitor page"
        />
        <Toggle
          label="Skeleton overlay"
          value={settings.show_skeleton}
          onChange={(v) => update("show_skeleton", v)}
          desc="Draw pose landmarks on camera feed"
        />
      </div>

      {/* Data */}
      <div className="card flex flex-col gap-3">
        <div className="text-xs font-semibold text-surface-muted uppercase tracking-wider">Data</div>
        <p className="text-xs text-surface-muted">
          All data is stored locally at <code className="font-mono text-brand-400">~/.posturexp/</code>.
          No cloud sync. No account required.
        </p>
        <p className="text-xs text-surface-muted">
          To reset all data, delete the <code className="font-mono text-brand-400">~/.posturexp</code> folder.
        </p>
      </div>
    </div>
  );
}
