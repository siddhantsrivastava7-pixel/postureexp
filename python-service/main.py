"""
PostureXP — Python CV Sidecar
Communicates with Tauri via stdin (commands) / stdout (JSON events).

Stdin protocol  : one JSON line per command  → {"cmd": "...", ...}
Stdout protocol : one JSON line per event    → {"type": "...", ...}

Run standalone for dev: python main.py
"""

import sys
import json
import threading
import time
import os
import signal

# ── stdout helpers ────────────────────────────────────────────────────────────

_stdout_lock = threading.Lock()

def _emit(obj: dict):
    with _stdout_lock:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

# Debug log to file — confirms sidecar actually ran
_log_dir = os.path.join(os.path.expanduser("~"), ".posturexp")
os.makedirs(_log_dir, exist_ok=True)
with open(os.path.join(_log_dir, "sidecar.log"), "a") as _lf:
    _lf.write(f"[{time.time():.0f}] sidecar started, emitting service_ready\n")

# Signal ready IMMEDIATELY — before any heavy imports that could be slow/crash
_emit({"type": "service_ready"})

# ── Heavy imports (cv2/mediapipe can take 30-60s on first PyInstaller run) ────

try:
    import cv2
    import numpy as np
    import mediapipe as mp
    from detector.posture import PostureDetector
    from detector.hand_face import HandFaceDetector
    from calibration.manager import CalibrationManager
    from storage.session import SessionStorage
    _IMPORTS_OK = True
except Exception as _import_err:
    _emit({"type": "error", "msg": f"import_failed: {_import_err}"})
    _IMPORTS_OK = False

# ── Graceful shutdown ─────────────────────────────────────────────────────────

def _shutdown(sig, frame):
    _emit({"type": "service_stopped"})
    sys.exit(0)

signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)

# ── State ─────────────────────────────────────────────────────────────────────

class AppState:
    monitoring: bool = False
    paused: bool = False
    calibrating: bool = False
    settings: dict = {
        "posture_sensitivity": "normal",       # relaxed / normal / strict
        "hand_face_sensitivity": "normal",
        "posture_persist_s": 4.0,
        "hand_face_persist_s": 1.2,
        "cooldown_s": 8.0,
        "show_skeleton": True,
        "sound_alerts": True,
        "desktop_notify": True,
        "camera_preview": True,
    }

state = AppState()

# ── Camera thread ─────────────────────────────────────────────────────────────

SENSITIVITY_MULTIPLIERS = {"relaxed": 1.5, "normal": 1.0, "strict": 0.7}

def camera_loop(storage: SessionStorage, calibration: CalibrationManager):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        _emit({"type": "error", "msg": "camera_unavailable"})
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    mp_pose = mp.solutions.pose
    mp_hands = mp.solutions.hands
    mp_face = mp.solutions.face_mesh

    posture_det = PostureDetector(calibration)
    hand_face_det = HandFaceDetector()

    FRAME_SKIP = 2  # process every Nth frame
    frame_idx = 0

    last_posture_warn = 0.0
    last_hf_warn = 0.0

    with mp_pose.Pose(
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6,
        model_complexity=1,
    ) as pose, mp_hands.Hands(
        max_num_hands=2,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5,
    ) as hands, mp_face.FaceMesh(
        max_num_faces=1,
        refine_landmarks=False,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.5,
    ) as face_mesh:

        while True:
            if not state.monitoring or state.paused:
                time.sleep(0.1)
                # Drain camera buffer while paused to avoid stale frames
                cap.grab()
                continue

            ret, frame = cap.read()
            if not ret:
                _emit({"type": "error", "msg": "frame_read_error"})
                time.sleep(0.5)
                continue

            frame_idx += 1
            if frame_idx % FRAME_SKIP != 0:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb.flags.writeable = False

            now = time.time()

            # ── Run detectors ─────────────────────────────────────────────

            pose_results   = pose.process(rgb)
            hand_results   = hands.process(rgb)
            face_results   = face_mesh.process(rgb)

            rgb.flags.writeable = True

            # ── Posture ───────────────────────────────────────────────────

            posture_status, posture_signals = posture_det.analyze(
                pose_results,
                frame.shape,
                sensitivity=SENSITIVITY_MULTIPLIERS.get(state.settings["posture_sensitivity"], 1.0),
            )

            if state.calibrating:
                calibration.feed(posture_signals)

            # ── Hand-near-face ────────────────────────────────────────────

            hf_status, hf_detail = hand_face_det.analyze(
                hand_results,
                face_results,
                frame.shape,
                sensitivity=SENSITIVITY_MULTIPLIERS.get(state.settings["hand_face_sensitivity"], 1.0),
            )

            # ── Build skeleton overlay frame (base64 JPEG) ────────────────

            frame_b64 = None
            if state.settings.get("camera_preview", True):
                vis_frame = frame.copy()
                if state.settings.get("show_skeleton", True):
                    if pose_results.pose_landmarks:
                        mp.solutions.drawing_utils.draw_landmarks(
                            vis_frame,
                            pose_results.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            landmark_drawing_spec=mp.solutions.drawing_utils.DrawingSpec(
                                color=(0, 255, 120), thickness=2, circle_radius=3
                            ),
                            connection_drawing_spec=mp.solutions.drawing_utils.DrawingSpec(
                                color=(0, 200, 80), thickness=2
                            ),
                        )
                    if hand_results.multi_hand_landmarks:
                        for hl in hand_results.multi_hand_landmarks:
                            mp.solutions.drawing_utils.draw_landmarks(
                                vis_frame, hl, mp_hands.HAND_CONNECTIONS,
                                mp.solutions.drawing_utils.DrawingSpec(color=(255, 165, 0), thickness=2, circle_radius=3),
                                mp.solutions.drawing_utils.DrawingSpec(color=(255, 120, 0), thickness=2),
                            )

                # Flip mirror
                vis_frame = cv2.flip(vis_frame, 1)
                # Resize to 320×240 for perf
                vis_small = cv2.resize(vis_frame, (320, 240))
                _, buf = cv2.imencode(".jpg", vis_small, [cv2.IMWRITE_JPEG_QUALITY, 65])
                import base64
                frame_b64 = base64.b64encode(buf).decode("ascii")

            # ── Emit frame event ──────────────────────────────────────────

            _emit({
                "type": "frame",
                "posture": posture_status,      # "good" | "warning" | "unknown"
                "hand_face": hf_status,         # "clean" | "warning" | "unknown"
                "signals": posture_signals,
                "hf_detail": hf_detail,
                "frame": frame_b64,
                "ts": now,
            })

            # ── Trigger warnings with cooldown ────────────────────────────

            persist_p = state.settings["posture_persist_s"]
            persist_h = state.settings["hand_face_persist_s"]
            cooldown  = state.settings["cooldown_s"]

            if posture_status == "warning":
                if now - last_posture_warn > cooldown:
                    # Check detector has seen warning for persist duration
                    if posture_det.warning_duration >= persist_p:
                        last_posture_warn = now
                        storage.record_posture_warning()
                        _emit({
                            "type": "alert",
                            "kind": "posture",
                            "msg": "Posture check — try sitting up straight",
                            "ts": now,
                        })

            if hf_status == "warning":
                if now - last_hf_warn > cooldown:
                    if hand_face_det.warning_duration >= persist_h:
                        last_hf_warn = now
                        storage.record_hf_warning()
                        _emit({
                            "type": "alert",
                            "kind": "hand_face",
                            "msg": "Hand near face detected",
                            "ts": now,
                        })

            # ── Record good posture time ──────────────────────────────────

            if posture_status == "good":
                storage.record_good_time(FRAME_SKIP / 30.0)

    cap.release()


# ── Stdin command listener ────────────────────────────────────────────────────

def stdin_listener(storage: SessionStorage, calibration: CalibrationManager):
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError:
            continue

        action = cmd.get("cmd", "")

        if action == "start":
            state.monitoring = True
            state.paused = False
            storage.session_start()
            _emit({"type": "monitoring_started"})

        elif action == "pause":
            state.paused = True
            _emit({"type": "monitoring_paused"})

        elif action == "resume":
            state.paused = False
            _emit({"type": "monitoring_resumed"})

        elif action == "stop":
            state.monitoring = False
            storage.session_end()
            _emit({"type": "monitoring_stopped"})

        elif action == "calibrate_start":
            state.calibrating = True
            calibration.begin()
            _emit({"type": "calibration_started"})

        elif action == "calibrate_stop":
            state.calibrating = False
            result = calibration.finish()
            _emit({"type": "calibration_done", "baseline": result})

        elif action == "update_settings":
            for k, v in cmd.get("settings", {}).items():
                state.settings[k] = v
            _emit({"type": "settings_updated"})

        elif action == "get_stats":
            stats = storage.get_stats()
            _emit({"type": "stats", "data": stats})

        elif action == "ping":
            _emit({"type": "pong"})


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    if not _IMPORTS_OK:
        # Keep stdin open so Tauri doesn't kill the process; errors already emitted
        for _ in sys.stdin:
            pass
        return

    # Resolve data dir
    data_dir = os.path.join(os.path.expanduser("~"), ".posturexp")
    os.makedirs(data_dir, exist_ok=True)

    storage     = SessionStorage(data_dir)
    calibration = CalibrationManager(data_dir)

    # Camera thread (daemon so it dies with main)
    cam_thread = threading.Thread(
        target=camera_loop, args=(storage, calibration), daemon=True
    )
    cam_thread.start()

    # Stdin listener (blocks main thread)
    stdin_listener(storage, calibration)


if __name__ == "__main__":
    main()
