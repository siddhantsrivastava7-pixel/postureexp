"""
Calibration manager.

During calibration (8-10 seconds), the posture detector feeds signal
dicts via feed(). finish() averages them and saves to disk.
"""

import json
import os
import statistics
from typing import Optional


class CalibrationManager:
    def __init__(self, data_dir: str):
        self._path = os.path.join(data_dir, "calibration.json")
        self._samples: list[dict] = []
        self.baseline: Optional[dict] = self._load()

    def begin(self):
        self._samples = []

    def feed(self, signals: dict):
        if signals:
            self._samples.append(signals)

    def finish(self) -> Optional[dict]:
        if len(self._samples) < 5:
            return None  # not enough data

        keys = self._samples[0].keys()
        averaged = {}
        for key in keys:
            vals = [s[key] for s in self._samples if key in s]
            if vals:
                averaged[key] = round(statistics.mean(vals), 4)

        self.baseline = averaged
        self._save(averaged)
        return averaged

    def _save(self, data: dict):
        with open(self._path, "w") as f:
            json.dump(data, f, indent=2)

    def _load(self) -> Optional[dict]:
        if os.path.exists(self._path):
            try:
                with open(self._path) as f:
                    return json.load(f)
            except Exception:
                return None
        return None
