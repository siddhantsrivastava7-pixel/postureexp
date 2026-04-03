/**
 * CV Bridge — wraps Tauri invoke/listen calls to the Rust backend.
 * Also handles graceful fallback for dev mode (outside Tauri).
 */

import type { AppSettings, CvEvent } from "../types";
import type { Dispatch } from "react";
import type { Action } from "./store";

let tauriAvailable = false;

// Dynamic import so the app doesn't crash in browser dev mode
let invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
let listen: (event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;

async function initTauri() {
  try {
    const api = await import("@tauri-apps/api");
    invoke = api.invoke as typeof invoke;
    listen = api.event.listen as typeof listen;
    tauriAvailable = true;
  } catch {
    tauriAvailable = false;
  }
}

initTauri();

// ── Sidecar lifecycle ─────────────────────────────────────────────────────

export async function startCvService(): Promise<void> {
  if (!tauriAvailable) return;
  await invoke("start_cv_service");
}

export async function stopCvService(): Promise<void> {
  if (!tauriAvailable) return;
  await invoke("stop_cv_service");
}

// ── Commands to Python ────────────────────────────────────────────────────

async function sendCommand(cmd: Record<string, unknown>): Promise<void> {
  if (!tauriAvailable) {
    console.debug("[cv-bridge] (dev mode) command:", cmd);
    return;
  }
  await invoke("send_cv_command", { command: cmd });
}

export const cvCommands = {
  start:           () => sendCommand({ cmd: "start" }),
  pause:           () => sendCommand({ cmd: "pause" }),
  resume:          () => sendCommand({ cmd: "resume" }),
  stop:            () => sendCommand({ cmd: "stop" }),
  calibrateStart:  () => sendCommand({ cmd: "calibrate_start" }),
  calibrateStop:   () => sendCommand({ cmd: "calibrate_stop" }),
  getStats:        () => sendCommand({ cmd: "get_stats" }),
  updateSettings:  (settings: Partial<AppSettings>) => sendCommand({ cmd: "update_settings", settings }),
  ping:            () => sendCommand({ cmd: "ping" }),
};

// ── Event listener setup ──────────────────────────────────────────────────

const CV_EVENTS = [
  "frame",
  "alert",
  "service_ready",
  "service_stopped",
  "monitoring_started",
  "monitoring_paused",
  "monitoring_resumed",
  "monitoring_stopped",
  "calibration_started",
  "calibration_done",
  "settings_updated",
  "stats",
  "error",
  "pong",
] as const;

export async function subscribeCvEvents(dispatch: Dispatch<Action>): Promise<() => void> {
  if (!tauriAvailable) return () => {};

  const unlisten: Array<() => void> = [];

  for (const eventName of CV_EVENTS) {
    const off = await listen(eventName, (e) => {
      const payload = e.payload as CvEvent;
      handleCvEvent(payload, dispatch);
    });
    unlisten.push(off);
  }

  return () => unlisten.forEach((fn) => fn());
}

// ── Event → dispatch ──────────────────────────────────────────────────────

import type { AchievementDetail, StatsPayload } from "../types";

let _prevTotalXp = 0;

function handleCvEvent(event: CvEvent, dispatch: Dispatch<Action>) {
  switch (event.type) {
    case "service_ready":
      dispatch({ type: "SERVICE_READY" });
      break;
    case "service_stopped":
      dispatch({ type: "SERVICE_STOPPED" });
      break;
    case "monitoring_started":
      dispatch({ type: "MONITORING_STARTED" });
      // Immediately poll stats
      cvCommands.getStats();
      break;
    case "monitoring_paused":
      dispatch({ type: "MONITORING_PAUSED" });
      break;
    case "monitoring_resumed":
      dispatch({ type: "MONITORING_RESUMED" });
      break;
    case "monitoring_stopped":
      dispatch({ type: "MONITORING_STOPPED" });
      cvCommands.getStats();
      break;
    case "calibration_started":
      dispatch({ type: "CALIBRATION_STARTED" });
      break;
    case "calibration_done":
      dispatch({ type: "CALIBRATION_DONE" });
      break;
    case "frame":
      dispatch({
        type: "FRAME_UPDATE",
        posture: event.posture,
        handFace: event.hand_face,
        frame: event.frame ?? null,
      });
      break;
    case "alert":
      dispatch({ type: "ALERT", alert: event });
      break;
    case "stats": {
      const stats = event.data as StatsPayload;
      dispatch({ type: "STATS_UPDATE", stats });

      // XP toast
      const newXp = stats.global.total_xp;
      if (_prevTotalXp > 0 && newXp > _prevTotalXp) {
        dispatch({ type: "SHOW_XP_TOAST", amount: newXp - _prevTotalXp });
        setTimeout(() => dispatch({ type: "CLEAR_XP_TOAST" }), 2500);
      }
      _prevTotalXp = newXp;

      // Achievement popup
      const details = stats.global.achievement_details ?? [];
      if (details.length > 0) {
        const newest = details[details.length - 1] as AchievementDetail;
        dispatch({ type: "SHOW_ACHIEVEMENT", achievement: newest });
        setTimeout(() => dispatch({ type: "CLEAR_ACHIEVEMENT" }), 5000);
      }
      break;
    }
    case "error":
      console.error("[cv-bridge] error:", event.msg);
      if (event.msg === "camera_unavailable") {
        dispatch({ type: "SERVICE_STOPPED" });
        alert("Camera not found or access was denied.\n\nOn Windows: Settings → Privacy → Camera → allow PostureXP.\nThen restart the app.");
      }
      break;
  }
}
