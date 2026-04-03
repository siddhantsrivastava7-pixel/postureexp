/**
 * Lightweight reactive store using React context + useReducer.
 * No external state library needed for MVP.
 */

import { createContext, useContext, useReducer, Dispatch } from "react";
import type { AppState, AppSettings, AlertEvent, StatsPayload, AchievementDetail } from "../types";

// ── Default state ─────────────────────────────────────────────────────────

const defaultSettings: AppSettings = {
  posture_sensitivity: "normal",
  hand_face_sensitivity: "normal",
  posture_persist_s: 4,
  hand_face_persist_s: 1.2,
  cooldown_s: 8,
  show_skeleton: true,
  sound_alerts: true,
  desktop_notify: true,
  camera_preview: true,
};

export const initialState: AppState = {
  monitoringState: "idle",
  serviceReady: false,
  posture: "unknown",
  handFace: "unknown",
  currentFrame: null,
  calibrated: false,
  stats: null,
  settings: defaultSettings,
  alerts: [],
  newAchievement: null,
  xpGained: null,
};

// ── Actions ───────────────────────────────────────────────────────────────

export type Action =
  | { type: "SERVICE_READY" }
  | { type: "SERVICE_STOPPED" }
  | { type: "MONITORING_STARTED" }
  | { type: "MONITORING_PAUSED" }
  | { type: "MONITORING_RESUMED" }
  | { type: "MONITORING_STOPPED" }
  | { type: "CALIBRATION_STARTED" }
  | { type: "CALIBRATION_DONE" }
  | { type: "FRAME_UPDATE"; posture: AppState["posture"]; handFace: AppState["handFace"]; frame: string | null }
  | { type: "ALERT"; alert: AlertEvent }
  | { type: "STATS_UPDATE"; stats: StatsPayload }
  | { type: "SETTINGS_UPDATE"; settings: Partial<AppSettings> }
  | { type: "SHOW_ACHIEVEMENT"; achievement: AchievementDetail }
  | { type: "CLEAR_ACHIEVEMENT" }
  | { type: "SHOW_XP_TOAST"; amount: number }
  | { type: "CLEAR_XP_TOAST" };

// ── Reducer ───────────────────────────────────────────────────────────────

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SERVICE_READY":
      return { ...state, serviceReady: true };
    case "SERVICE_STOPPED":
      return { ...state, serviceReady: false, monitoringState: "idle" };
    case "MONITORING_STARTED":
      return { ...state, monitoringState: "running" };
    case "MONITORING_PAUSED":
      return { ...state, monitoringState: "paused" };
    case "MONITORING_RESUMED":
      return { ...state, monitoringState: "running" };
    case "MONITORING_STOPPED":
      return { ...state, monitoringState: "idle", posture: "unknown", handFace: "unknown", currentFrame: null };
    case "CALIBRATION_STARTED":
      return { ...state, monitoringState: "calibrating" };
    case "CALIBRATION_DONE":
      return { ...state, monitoringState: "running", calibrated: true };
    case "FRAME_UPDATE":
      return { ...state, posture: action.posture, handFace: action.handFace, currentFrame: action.frame };
    case "ALERT":
      return {
        ...state,
        alerts: [action.alert, ...state.alerts].slice(0, 50),
      };
    case "STATS_UPDATE":
      return { ...state, stats: action.stats };
    case "SETTINGS_UPDATE":
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "SHOW_ACHIEVEMENT":
      return { ...state, newAchievement: action.achievement };
    case "CLEAR_ACHIEVEMENT":
      return { ...state, newAchievement: null };
    case "SHOW_XP_TOAST":
      return { ...state, xpGained: action.amount };
    case "CLEAR_XP_TOAST":
      return { ...state, xpGained: null };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────

export const StoreContext = createContext<{
  state: AppState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
