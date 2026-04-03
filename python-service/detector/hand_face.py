"""
Hand-near-face proximity detector.

Strategy:
  - Use MediaPipe Face Mesh landmarks to define face zones (nose, mouth, eyes, cheeks, chin)
  - Use MediaPipe Hands fingertip landmarks
  - Compute normalised 2D distance from each fingertip to each face zone centroid
  - Sustained proximity (configurable frames / seconds) triggers a warning event
"""

import time
from typing import Optional

# MediaPipe face landmark indices for key zones
_FACE_ZONES = {
    "nose":   [1, 2, 3, 4, 5, 6],
    "mouth":  [13, 14, 78, 308],
    "chin":   [152, 175, 199],
    "l_eye":  [33, 133, 159, 145],
    "r_eye":  [362, 263, 386, 374],
    "l_cheek":[234, 93],
    "r_cheek":[454, 323],
}

# MediaPipe hands — fingertip landmark indices
_FINGERTIPS = [4, 8, 12, 16, 20]

# Proximity threshold in normalised image coords (0..1)
_PROXIMITY_BASE = 0.14   # ~14% of frame width


def _centroid(landmarks, indices):
    xs = [landmarks.landmark[i].x for i in indices]
    ys = [landmarks.landmark[i].y for i in indices]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def _dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


class HandFaceDetector:
    def __init__(self):
        self._proximity_start: Optional[float] = None
        self.warning_duration: float = 0.0

    def analyze(self, hand_results, face_results, frame_shape, sensitivity: float = 1.0):
        """
        Returns (status: str, detail: dict).
        status = "clean" | "warning" | "unknown"
        """
        if not face_results.multi_face_landmarks or not hand_results.multi_hand_landmarks:
            self._reset()
            return "clean", {}

        face_lms = face_results.multi_face_landmarks[0]
        threshold = _PROXIMITY_BASE * sensitivity

        # Build face zone centroids
        zone_centroids = {
            zone: _centroid(face_lms, idxs)
            for zone, idxs in _FACE_ZONES.items()
        }

        closest_dist = float("inf")
        closest_zone = None
        closest_hand = None

        for hi, hand_lms in enumerate(hand_results.multi_hand_landmarks):
            for tip_idx in _FINGERTIPS:
                tip = hand_lms.landmark[tip_idx]
                tp = (tip.x, tip.y)
                for zone, centroid in zone_centroids.items():
                    d = _dist(tp, centroid)
                    if d < closest_dist:
                        closest_dist = d
                        closest_zone = zone
                        closest_hand = hi

        detail = {
            "closest_dist": round(closest_dist, 4),
            "closest_zone": closest_zone,
            "hand_idx": closest_hand,
            "threshold": round(threshold, 4),
        }

        if closest_dist < threshold:
            self._update_timer()
            return "warning", detail
        else:
            self._reset()
            return "clean", detail

    def _update_timer(self):
        now = time.monotonic()
        if self._proximity_start is None:
            self._proximity_start = now
        self.warning_duration = now - self._proximity_start

    def _reset(self):
        self._proximity_start = None
        self.warning_duration = 0.0
