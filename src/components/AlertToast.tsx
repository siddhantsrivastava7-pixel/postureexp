import { useStore } from "../lib/store";
import { AlertTriangle } from "lucide-react";
import { formatTime } from "../lib/utils";

export default function AlertToast() {
  const { state } = useStore();
  const latest = state.alerts[0];

  if (!latest) return null;

  const isPosture = latest.kind === "posture";

  return (
    <div
      key={latest.ts}
      className="fixed bottom-6 left-6 z-50 animate-slide-up pointer-events-none"
    >
      <div
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-xl border text-sm font-medium ${
          isPosture
            ? "bg-warning/10 border-warning/30 text-warning"
            : "bg-danger/10 border-danger/30 text-danger"
        }`}
      >
        <AlertTriangle size={16} />
        <span>{latest.msg}</span>
        <span className="text-xs opacity-60 ml-2">{formatTime(latest.ts)}</span>
      </div>
    </div>
  );
}
