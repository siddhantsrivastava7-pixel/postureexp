"""
Session & stats storage using JSON files.

Files:
  ~/.posturexp/sessions.json  — list of daily session records
  ~/.posturexp/stats.json     — aggregated totals (XP, streaks, etc.)
"""

import json
import os
import time
from datetime import datetime, date
from typing import Optional


_EMPTY_STATS = {
    "total_xp": 0,
    "level": 1,
    "posture_streak_days": 0,
    "hf_streak_days": 0,
    "last_session_date": None,
    "achievements": [],
}

_XP_PER_LEVEL = 200   # XP required to level up (each level costs same for MVP)


class SessionStorage:
    def __init__(self, data_dir: str):
        self._sessions_path = os.path.join(data_dir, "sessions.json")
        self._stats_path    = os.path.join(data_dir, "stats.json")

        self._stats    = self._load_json(self._stats_path, _EMPTY_STATS)
        self._sessions = self._load_json(self._sessions_path, [])

        # Current session accumulators
        self._session_start: Optional[float] = None
        self._good_posture_s: float = 0.0
        self._posture_warnings: int = 0
        self._hf_warnings: int = 0
        self._session_xp: int = 0
        self._good_xp_counter: float = 0.0   # tracks seconds for XP award
        self._hf_clean_counter: float = 0.0  # tracks clean intervals

    # ── Session lifecycle ──────────────────────────────────────────────────

    def session_start(self):
        self._session_start = time.time()
        self._good_posture_s = 0.0
        self._posture_warnings = 0
        self._hf_warnings = 0
        self._session_xp = 0
        self._good_xp_counter = 0.0
        self._hf_clean_counter = 0.0

    def session_end(self):
        if self._session_start is None:
            return
        duration = time.time() - self._session_start
        today = date.today().isoformat()

        session_record = {
            "date": today,
            "duration_s": round(duration),
            "good_posture_s": round(self._good_posture_s),
            "posture_warnings": self._posture_warnings,
            "hf_warnings": self._hf_warnings,
            "xp_earned": self._session_xp,
            "ts": time.time(),
        }

        self._sessions.append(session_record)
        self._save_json(self._sessions_path, self._sessions[-90:])  # keep 90 days

        # Update global stats
        self._stats["total_xp"] += self._session_xp
        self._stats["level"] = max(1, self._stats["total_xp"] // _XP_PER_LEVEL + 1)
        self._stats["last_session_date"] = today
        self._check_achievements(session_record)
        self._update_streaks(today)
        self._save_json(self._stats_path, self._stats)

        self._session_start = None

    # ── Real-time recording ────────────────────────────────────────────────

    def record_good_time(self, delta_s: float):
        """Call from camera loop with frame delta time while posture is good."""
        self._good_posture_s += delta_s
        self._good_xp_counter += delta_s

        # +1 XP every 20 seconds of good posture
        if self._good_xp_counter >= 20.0:
            self._good_xp_counter -= 20.0
            self._session_xp += 1

        # +2 XP for every 120s clean interval without hf warning
        self._hf_clean_counter += delta_s
        if self._hf_clean_counter >= 120.0:
            self._hf_clean_counter -= 120.0
            if self._hf_warnings == 0:
                self._session_xp += 2

    def record_posture_warning(self):
        self._posture_warnings += 1

    def record_hf_warning(self):
        self._hf_warnings += 1
        self._hf_clean_counter = 0.0  # reset clean interval

    # ── Stats query ────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        today = date.today().isoformat()
        today_sessions = [s for s in self._sessions if s.get("date") == today]

        return {
            "global": self._stats,
            "today": {
                "sessions": len(today_sessions),
                "total_xp": sum(s["xp_earned"] for s in today_sessions),
                "good_posture_s": sum(s["good_posture_s"] for s in today_sessions),
                "posture_warnings": sum(s["posture_warnings"] for s in today_sessions),
                "hf_warnings": sum(s["hf_warnings"] for s in today_sessions),
            },
            "session": {
                "active": self._session_start is not None,
                "duration_s": round(time.time() - self._session_start) if self._session_start else 0,
                "good_posture_s": round(self._good_posture_s),
                "posture_warnings": self._posture_warnings,
                "hf_warnings": self._hf_warnings,
                "session_xp": self._session_xp,
            },
            "week": self._get_week_summary(),
        }

    def _get_week_summary(self) -> list:
        from datetime import timedelta
        result = []
        today = date.today()
        for i in range(6, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            day_sessions = [s for s in self._sessions if s.get("date") == d]
            result.append({
                "date": d,
                "xp": sum(s["xp_earned"] for s in day_sessions),
                "posture_warnings": sum(s["posture_warnings"] for s in day_sessions),
                "hf_warnings": sum(s["hf_warnings"] for s in day_sessions),
                "good_posture_s": sum(s["good_posture_s"] for s in day_sessions),
            })
        return result

    # ── Achievements ───────────────────────────────────────────────────────

    _ACHIEVEMENT_DEFS = [
        {"id": "straight_spine",   "name": "Straight Spine",   "desc": "10 minutes of good posture in one session",      "icon": "🦴"},
        {"id": "focus_monk",       "name": "Focus Monk",        "desc": "30 min session with fewer than 3 posture warnings","icon": "🧘"},
        {"id": "hands_off",        "name": "Hands Off",         "desc": "20 minutes without a face-touch alert",           "icon": "✋"},
        {"id": "consistency_1",    "name": "Consistency I",     "desc": "3 sessions in one day",                           "icon": "📅"},
        {"id": "xp_100",           "name": "XP Rookie",         "desc": "Earn 100 total XP",                               "icon": "⭐"},
        {"id": "xp_500",           "name": "XP Hunter",         "desc": "Earn 500 total XP",                               "icon": "🌟"},
        {"id": "xp_1000",          "name": "XP Legend",         "desc": "Earn 1000 total XP",                              "icon": "💫"},
        {"id": "level_5",          "name": "Level 5",           "desc": "Reach level 5",                                   "icon": "🔥"},
    ]

    def _check_achievements(self, session: dict):
        unlocked = self._stats.get("achievements", [])
        new_unlocks = []
        today_sessions = [s for s in self._sessions if s.get("date") == session["date"]]

        for ach in self._ACHIEVEMENT_DEFS:
            if ach["id"] in unlocked:
                continue

            earned = False
            aid = ach["id"]

            if aid == "straight_spine"  and session["good_posture_s"] >= 600:  earned = True
            if aid == "focus_monk"      and session["duration_s"] >= 1800 and session["posture_warnings"] < 3: earned = True
            if aid == "hands_off"       and session["good_posture_s"] >= 1200 and session["hf_warnings"] == 0: earned = True
            if aid == "consistency_1"   and len(today_sessions) >= 3:           earned = True
            if aid == "xp_100"          and self._stats["total_xp"] >= 100:     earned = True
            if aid == "xp_500"          and self._stats["total_xp"] >= 500:     earned = True
            if aid == "xp_1000"         and self._stats["total_xp"] >= 1000:    earned = True
            if aid == "level_5"         and self._stats["level"] >= 5:          earned = True

            if earned:
                unlocked.append(aid)
                new_unlocks.append(ach)

        self._stats["achievements"] = unlocked
        # Bonus XP for unlocks
        self._stats["total_xp"] += len(new_unlocks) * 25

        # Store full achievement objects for display
        if "achievement_details" not in self._stats:
            self._stats["achievement_details"] = []
        for a in new_unlocks:
            self._stats["achievement_details"].append({**a, "unlocked_at": date.today().isoformat()})

    def _update_streaks(self, today: str):
        from datetime import timedelta
        last = self._stats.get("last_session_date")
        if last:
            last_d = date.fromisoformat(last)
            today_d = date.fromisoformat(today)
            diff = (today_d - last_d).days
            if diff == 1:
                self._stats["posture_streak_days"] = self._stats.get("posture_streak_days", 0) + 1
                self._stats["hf_streak_days"] = self._stats.get("hf_streak_days", 0) + 1
            elif diff > 1:
                self._stats["posture_streak_days"] = 1
                self._stats["hf_streak_days"] = 1
        else:
            self._stats["posture_streak_days"] = 1
            self._stats["hf_streak_days"] = 1

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _load_json(path: str, default):
        if os.path.exists(path):
            try:
                with open(path) as f:
                    return json.load(f)
            except Exception:
                return default
        return default

    @staticmethod
    def _save_json(path: str, data):
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
