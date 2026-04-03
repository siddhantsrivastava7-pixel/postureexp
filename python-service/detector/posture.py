"""
Posture detector using MediaPipe pose landmarks.

Signals computed:
  - forward_head_ratio   : ear_x relative to shoulder_x (normalised)
  - neck_angle           : angle of ear-shoulder vector
  - shoulder_slope       : shoulder height asymmetry
  - torso_lean           : nose horizontal offset from hip midpoint

Calibration baseline is used as reference — deviations trigger warnings.
"""

import math
import time
from typing import Optional
import numpy as np

# MediaPipe landmark indices (pose)
_NOSE       = 0
_L_EAR      = 7
_R_EAR      = 8
_L_SHOULDER = 11
_R_SHOULDER = 12
_L_HIP      = 23
_R_HIP      = 24


def _lm(landmarks, idx):
    l = landmarks.landmark[idx]
    return l.x, l.y, l.visibility


def _midpoint(a, b):
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def _angle_deg(p1, p2):
    """Angle of vector p1→p2 in degrees from horizontal."""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return math.degrees(math.atan2(dy, dx))


class PostureDetector:
    VISIBILITY_THRESHOLD = 0.5

    def __init__(self, calibration_mgr):
        self.calibration = calibration_mgr
        self._warning_start: Optional[float] = None
        self.warning_duration: float = 0.0

    # ── Public API ─────────────────────────────────────────────────────────

    def analyze(self, pose_results, frame_shape, sensitivity: float = 1.0):
        """
        Returns (status: str, signals: dict).
        status = "good" | "warning" | "unknown"
        """
        if not pose_results.pose_landmarks:
            self._reset_warning()
            return "unknown", {}

        lms = pose_results.pose_landmarks
        h, w = frame_shape[:2]

        try:
            signals = self._compute_signals(lms, w, h)
        except Exception:
            self._reset_warning()
            return "unknown", {}

        status = self._evaluate(signals, sensitivity)
        self._update_warning_timer(status)
        return status, signals

    # ── Internal ───────────────────────────────────────────────────────────

    def _compute_signals(self, landmarks, w, h) -> dict:
        nose        = _lm(landmarks, _NOSE)
        l_ear       = _lm(landmarks, _L_EAR)
        r_ear       = _lm(landmarks, _R_EAR)
        l_shoulder  = _lm(landmarks, _L_SHOULDER)
        r_shoulder  = _lm(landmarks, _R_SHOULDER)
        l_hip       = _lm(landmarks, _L_HIP)
        r_hip       = _lm(landmarks, _R_HIP)

        # Need at least shoulders visible
        if l_shoulder[2] < self.VISIBILITY_THRESHOLD and r_shoulder[2] < self.VISIBILITY_THRESHOLD:
            raise ValueError("shoulders not visible")

        # Use whichever shoulder/ear is more visible
        if l_shoulder[2] >= r_shoulder[2]:
            ear      = l_ear
            shoulder = l_shoulder
        else:
            ear      = r_ear
            shoulder = r_shoulder

        shoulder_mid = _midpoint(l_shoulder, r_shoulder)
        hip_mid      = _midpoint(l_hip, r_hip)

        # ── Forward head ratio ─────────────────────────────────────────────
        # Positive = ear in front of shoulder (forward head posture)
        forward_head = shoulder[0] - ear[0]  # in normalised coords

        # ── Neck angle ─────────────────────────────────────────────────────
        neck_angle = _angle_deg(shoulder[:2], ear[:2])  # degrees

        # ── Shoulder slope (asymmetry) ──────────────────────────────────────
        shoulder_slope = abs(l_shoulder[1] - r_shoulder[1])

        # ── Torso lean ──────────────────────────────────────────────────────
        torso_lean = abs(shoulder_mid[0] - hip_mid[0])

        # ── Ear-shoulder distance (slouch proxy) ────────────────────────────
        ear_shoulder_dy = shoulder[1] - ear[1]  # positive = ear above shoulder

        return {
            "forward_head":     round(forward_head, 4),
            "neck_angle":       round(neck_angle, 2),
            "shoulder_slope":   round(shoulder_slope, 4),
            "torso_lean":       round(torso_lean, 4),
            "ear_shoulder_dy":  round(ear_shoulder_dy, 4),
        }

    def _evaluate(self, signals: dict, sensitivity: float) -> str:
        baseline = self.calibration.baseline
        if baseline is None:
            # No calibration: use conservative universal thresholds
            return self._universal_check(signals, sensitivity)

        # Thresholds as fraction of baseline value (or absolute delta)
        deviations = []

        # Forward head deviation
        bfh = baseline.get("forward_head", signals["forward_head"])
        delta_fh = signals["forward_head"] - bfh
        # Forward head worsens when ear moves forward (delta > 0 in our coord)
        if delta_fh > 0.04 * sensitivity:
            deviations.append(("forward_head", delta_fh))

        # Neck angle
        bna = baseline.get("neck_angle", signals["neck_angle"])
        delta_na = abs(signals["neck_angle"] - bna)
        if delta_na > 12 * sensitivity:
            deviations.append(("neck_angle", delta_na))

        # Shoulder slope
        bss = baseline.get("shoulder_slope", signals["shoulder_slope"])
        delta_ss = signals["shoulder_slope"] - bss
        if delta_ss > 0.03 * sensitivity:
            deviations.append(("shoulder_slope", delta_ss))

        # Ear-shoulder dy (slouch: ears drop toward shoulders)
        bdy = baseline.get("ear_shoulder_dy", signals["ear_shoulder_dy"])
        delta_dy = bdy - signals["ear_shoulder_dy"]
        if delta_dy > 0.05 * sensitivity:
            deviations.append(("ear_shoulder_dy", delta_dy))

        return "warning" if len(deviations) >= 2 else "good"

    def _universal_check(self, signals: dict, sensitivity: float) -> str:
        """Fallback heuristics when no calibration exists."""
        bad = 0
        if abs(signals["forward_head"]) > 0.06 * sensitivity:
            bad += 1
        if signals["shoulder_slope"] > 0.05 * sensitivity:
            bad += 1
        if signals["ear_shoulder_dy"] < 0.08:
            bad += 1
        return "warning" if bad >= 2 else "good"

    def _update_warning_timer(self, status: str):
        now = time.monotonic()
        if status == "warning":
            if self._warning_start is None:
                self._warning_start = now
            self.warning_duration = now - self._warning_start
        else:
            self._reset_warning()

    def _reset_warning(self):
        self._warning_start = None
        self.warning_duration = 0.0
