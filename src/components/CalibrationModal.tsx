import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { cvCommands } from "../lib/cv-bridge";
import { CheckCircle, Camera } from "lucide-react";

const CALIBRATION_SECONDS = 9;

export default function CalibrationModal() {
  const { dispatch } = useStore();
  const [countdown, setCountdown] = useState(CALIBRATION_SECONDS);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      setDone(true);
      cvCommands.calibrateStop();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const pct = ((CALIBRATION_SECONDS - countdown) / CALIBRATION_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-[420px] flex flex-col items-center gap-5 p-8 animate-bounce-in">
        {!done ? (
          <>
            <Camera size={36} className="text-brand-400" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Calibrating Good Posture</h2>
              <p className="text-sm text-surface-muted mt-2">
                Sit in your best posture and stay still for {CALIBRATION_SECONDS} seconds.
                Spino will remember this as your baseline.
              </p>
            </div>

            {/* Progress ring */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="50" fill="none" stroke="#2a2d3a" strokeWidth="8"/>
                <circle
                  cx="56" cy="56" r="50" fill="none"
                  stroke="#22c55e" strokeWidth="8"
                  strokeDasharray={314}
                  strokeDashoffset={314 - (314 * pct) / 100}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span className="text-4xl font-extrabold text-white">{countdown}</span>
            </div>

            <p className="text-xs text-surface-muted text-center">
              Sit straight · Shoulders back · Eyes forward
            </p>
          </>
        ) : (
          <>
            <CheckCircle size={48} className="text-brand-400 animate-bounce-in" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">Calibration Complete!</h2>
              <p className="text-sm text-surface-muted mt-2">
                Spino now knows your good posture baseline. Monitoring is active.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => dispatch({ type: "CALIBRATION_DONE" })}
            >
              Start Monitoring
            </button>
          </>
        )}
      </div>
    </div>
  );
}
