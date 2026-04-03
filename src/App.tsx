import { useReducer, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { StoreContext, reducer, initialState } from "./lib/store";
import { startCvService, subscribeCvEvents, cvCommands } from "./lib/cv-bridge";
import { playPostureAlert, playHandFaceAlert, playXpGain } from "./lib/sounds";
import Sidebar from "./components/Sidebar";
import MonitorPage from "./pages/MonitorPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import CalibrationModal from "./components/CalibrationModal";
import AchievementPopup from "./components/AchievementPopup";
import XpToast from "./components/XpToast";
import AlertToast from "./components/AlertToast";

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ── Boot CV service ───────────────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      unsub = await subscribeCvEvents(dispatch);
      await startCvService();
    })();

    return () => {
      unsub?.();
    };
  }, []);

  // ── Poll stats every 5s while monitoring ─────────────────────────────
  useEffect(() => {
    if (state.monitoringState !== "running") return;
    const id = setInterval(() => cvCommands.getStats(), 5000);
    return () => clearInterval(id);
  }, [state.monitoringState]);

  // ── Sound effects on alerts ───────────────────────────────────────────
  useEffect(() => {
    if (!state.settings.sound_alerts) return;
    if (state.alerts.length === 0) return;
    const latest = state.alerts[0];
    if (latest.kind === "posture") playPostureAlert();
    else playHandFaceAlert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.alerts.length]);

  // ── XP gain sound ─────────────────────────────────────────────────────
  useEffect(() => {
    if (state.xpGained && state.settings.sound_alerts) playXpGain();
  }, [state.xpGained, state.settings.sound_alerts]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden bg-surface">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/monitor" replace />} />
              <Route path="/monitor"   element={<MonitorPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings"  element={<SettingsPage />} />
            </Routes>
          </main>
        </div>

        {/* Overlays */}
        {state.monitoringState === "calibrating" && <CalibrationModal />}
        {state.newAchievement && <AchievementPopup achievement={state.newAchievement} />}
        {state.xpGained       && <XpToast amount={state.xpGained} />}
        <AlertToast />
      </BrowserRouter>
    </StoreContext.Provider>
  );
}
