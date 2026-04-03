// ── CV Event types (mirrors Python stdout protocol) ───────────────────────

export type PostureStatus  = "good" | "warning" | "unknown";
export type HandFaceStatus = "clean" | "warning" | "unknown";

export interface FrameEvent {
  type: "frame";
  posture: PostureStatus;
  hand_face: HandFaceStatus;
  signals: Record<string, number>;
  hf_detail: Record<string, number | string | null>;
  frame: string | null;  // base64 JPEG
  ts: number;
}

export interface AlertEvent {
  type: "alert";
  kind: "posture" | "hand_face";
  msg: string;
  ts: number;
}

export type CvEvent =
  | FrameEvent
  | AlertEvent
  | { type: "service_ready" }
  | { type: "service_stopped" }
  | { type: "monitoring_started" }
  | { type: "monitoring_paused" }
  | { type: "monitoring_resumed" }
  | { type: "monitoring_stopped" }
  | { type: "calibration_started" }
  | { type: "calibration_done"; baseline: Record<string, number> | null }
  | { type: "settings_updated" }
  | { type: "stats"; data: StatsPayload }
  | { type: "error"; msg: string }
  | { type: "pong" };

// ── Stats ──────────────────────────────────────────────────────────────────

export interface GlobalStats {
  total_xp: number;
  level: number;
  posture_streak_days: number;
  hf_streak_days: number;
  last_session_date: string | null;
  achievements: string[];
  achievement_details?: AchievementDetail[];
}

export interface DayStats {
  sessions: number;
  total_xp: number;
  good_posture_s: number;
  posture_warnings: number;
  hf_warnings: number;
}

export interface SessionStats {
  active: boolean;
  duration_s: number;
  good_posture_s: number;
  posture_warnings: number;
  hf_warnings: number;
  session_xp: number;
}

export interface WeekDay {
  date: string;
  xp: number;
  posture_warnings: number;
  hf_warnings: number;
  good_posture_s: number;
}

export interface StatsPayload {
  global: GlobalStats;
  today: DayStats;
  session: SessionStats;
  week: WeekDay[];
}

export interface AchievementDetail {
  id: string;
  name: string;
  desc: string;
  icon: string;
  unlocked_at?: string;
}

// ── App settings ───────────────────────────────────────────────────────────

export type Sensitivity = "relaxed" | "normal" | "strict";

export interface AppSettings {
  posture_sensitivity: Sensitivity;
  hand_face_sensitivity: Sensitivity;
  posture_persist_s: number;
  hand_face_persist_s: number;
  cooldown_s: number;
  show_skeleton: boolean;
  sound_alerts: boolean;
  desktop_notify: boolean;
  camera_preview: boolean;
}

// ── App state ──────────────────────────────────────────────────────────────

export type MonitoringState = "idle" | "running" | "paused" | "calibrating";

export interface AppState {
  monitoringState: MonitoringState;
  serviceReady: boolean;
  posture: PostureStatus;
  handFace: HandFaceStatus;
  currentFrame: string | null;
  calibrated: boolean;
  stats: StatsPayload | null;
  settings: AppSettings;
  alerts: AlertEvent[];
  newAchievement: AchievementDetail | null;
  xpGained: number | null;   // for toast
}
