# PostureXP

> A webcam-based posture & habit coach with XP, streaks, and Spino the mascot.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Python | 3.10 – 3.12 | 3.11 recommended |
| Tauri CLI prereqs | — | [Platform-specific](https://tauri.app/v1/guides/getting-started/prerequisites) |

---

## Quick Start (Development)

### 1 — Clone and install JS deps

```bash
git clone <repo>
cd posturexp
npm install
```

### 2 — Set up Python service

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 3 — Build the Python sidecar binary

```bash
cd python-service
chmod +x build_sidecar.sh
./build_sidecar.sh
```

This produces `python-service/dist/posture-cv` (or `.exe` on Windows).

### 4 — Install the sidecar binary for Tauri

Tauri sidecars require the binary to be named with the target triple suffix.

```bash
mkdir -p src-tauri/binaries

# macOS (Apple Silicon)
cp python-service/dist/posture-cv src-tauri/binaries/posture-cv-aarch64-apple-darwin

# macOS (Intel)
cp python-service/dist/posture-cv src-tauri/binaries/posture-cv-x86_64-apple-darwin

# Windows
copy python-service\dist\posture-cv.exe src-tauri\binaries\posture-cv-x86_64-pc-windows-msvc.exe

# Linux
cp python-service/dist/posture-cv src-tauri/binaries/posture-cv-x86_64-unknown-linux-gnu
```

> Tip: Run `rustc -Vv | grep host` to print your exact target triple.

### 5 — Run in dev mode

```bash
npm run tauri dev
```

This starts:
- Vite dev server on `localhost:1420`
- Tauri window loading from Vite
- Python CV sidecar (spawned by Rust on first `start_cv_service` call)

---

## Building for Production

```bash
npm run tauri build
```

Output:
- macOS: `src-tauri/target/release/bundle/macos/PostureXP.app` + `.dmg`
- Windows: `src-tauri/target/release/bundle/msi/PostureXP_x.y.z_x64_en-US.msi`
- Linux: `src-tauri/target/release/bundle/deb/posturexp_x.y.z_amd64.deb`

---

## How It Works

### Posture Detection

1. MediaPipe Pose extracts 33 landmarks per frame (nose, ears, shoulders, hips, etc.)
2. Five signals are computed each frame:
   - **forward_head_ratio** — ear position relative to shoulder (detects forward head posture)
   - **neck_angle** — angle of the ear-to-shoulder vector
   - **shoulder_slope** — left/right shoulder height asymmetry
   - **torso_lean** — shoulder midpoint offset from hip midpoint
   - **ear_shoulder_dy** — ear/shoulder vertical proximity (slouch indicator)
3. **Calibration**: user sits in good posture for 9 seconds → signals are averaged → stored as baseline in `~/.posturexp/calibration.json`
4. Each frame's signals are compared against the baseline. ≥2 signals deviate beyond threshold → `warning` state
5. Warning only fires an alert after continuously staying in `warning` for `posture_persist_s` (default 4s)
6. Cooldown prevents alert spam (default 8s between alerts)

### Hand-Near-Face Detection

1. MediaPipe Hands (up to 2 hands) + Face Mesh (1 face) run in parallel
2. Face zones are defined by landmark groups: nose, mouth, chin, eyes, cheeks
3. Each fingertip landmark is tested against each zone centroid
4. If any fingertip is within the proximity threshold (14% of frame width, sensitivity-adjusted), a proximity event starts
5. Alert fires only after the proximity persists for `hand_face_persist_s` (default 1.2s)

### XP System

| Event | XP |
|-------|----|
| 20s of good posture | +1 XP |
| 120s clean interval (no face-touch) | +2 XP |
| Achievement unlock | +25 XP |

Level = `floor(total_xp / 200) + 1`

---

## Data Storage

All data lives locally at `~/.posturexp/`:

| File | Contents |
|------|----------|
| `calibration.json` | Posture baseline signals |
| `sessions.json` | Last 90 daily session records |
| `stats.json` | Global XP, level, streaks, achievements |

---

## Architecture

```
Tauri (Rust)
  ├── Spawns python sidecar (posture-cv binary)
  ├── Reads stdout JSON lines → emits as Tauri events to frontend
  └── Forwards stdin JSON commands from frontend to sidecar

Python Sidecar
  ├── Camera loop thread (OpenCV + MediaPipe)
  │     ├── PostureDetector → signals + status
  │     ├── HandFaceDetector → proximity + status
  │     └── Emits frame/alert events via stdout
  └── Stdin listener thread (receives commands from Rust)

React Frontend
  ├── cv-bridge.ts  — wraps Tauri invoke/listen
  ├── store.ts      — useReducer app state
  ├── MonitorPage   — live camera, status, XP, streaks, event feed
  ├── DashboardPage — 7-day history, achievements
  └── SettingsPage  — all knobs and toggles
```

---

## Project Structure

```
posturexp/
├── src/                         # React + TypeScript frontend
│   ├── components/
│   │   ├── Sidebar.tsx          # Nav + Spino mascot + XP bar
│   │   ├── Spino.tsx            # SVG mascot (happy/slouchy/idle)
│   │   ├── CalibrationModal.tsx # 9-second calibration flow
│   │   ├── AchievementPopup.tsx # Achievement unlock toast
│   │   ├── XpToast.tsx          # +XP floating toast
│   │   ├── AlertToast.tsx       # Warning toast
│   │   └── StatusBadge.tsx      # Posture/HandFace badges
│   ├── pages/
│   │   ├── MonitorPage.tsx      # Main monitoring view
│   │   ├── DashboardPage.tsx    # History + achievements
│   │   └── SettingsPage.tsx     # Settings
│   ├── lib/
│   │   ├── store.ts             # App state (reducer + context)
│   │   ├── cv-bridge.ts         # Tauri ↔ Python bridge
│   │   ├── sounds.ts            # Web Audio alert sounds
│   │   └── utils.ts             # Formatting helpers
│   ├── types/index.ts           # All TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── python-service/              # Python CV sidecar
│   ├── main.py                  # Entry point + camera loop
│   ├── detector/
│   │   ├── posture.py           # Pose landmark analysis
│   │   └── hand_face.py        # Hand-near-face proximity
│   ├── calibration/
│   │   └── manager.py          # Baseline calibration
│   ├── storage/
│   │   └── session.py          # JSON persistence + XP engine
│   ├── models/                  # Custom models (future use)
│   ├── requirements.txt
│   └── build_sidecar.sh        # PyInstaller build script
└── src-tauri/
    ├── src/main.rs              # Sidecar bridge + system tray
    ├── binaries/                # Place compiled sidecar here
    ├── Cargo.toml
    ├── tauri.conf.json
    └── build.rs
```

---

## Edge Cases Handled

- **User leaves frame** → `unknown` posture status, no false alerts
- **No calibration** → universal threshold fallback (still works, less accurate)
- **Partial body** → visibility check on landmarks, graceful degradation
- **Camera unavailable** → `camera_unavailable` error emitted, shown in UI
- **Monitoring paused** → camera buffer drained, no stale frame alerts
- **Cooldowns** → prevents alert spam regardless of detection rate
- **App close** → minimizes to system tray, sidecar keeps running

---

## Future Improvements

- [ ] `FUTURE: native OS desktop notifications` (need `@tauri-apps/plugin-notification` wiring)
- [ ] `FUTURE: daily challenge card` (e.g., "No face touches before noon")
- [ ] `FUTURE: session summary screen` after Stop
- [ ] `FUTURE: animated level-up popup with particle effects`
- [ ] `FUTURE: multi-camera support`
- [ ] `FUTURE: export stats to CSV`
