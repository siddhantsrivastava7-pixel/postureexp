#!/usr/bin/env bash
# Build the Python CV sidecar into a single binary using PyInstaller.
# Run from the python-service/ directory.
# Output goes to dist/posture-cv (Linux/macOS) or dist/posture-cv.exe (Windows).

set -e

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Building sidecar with PyInstaller..."
pyinstaller \
  --onefile \
  --name posture-cv \
  --hidden-import mediapipe \
  --hidden-import cv2 \
  --hidden-import numpy \
  --collect-data mediapipe \
  main.py

echo "==> Done. Binary at dist/posture-cv"
echo ""
echo "Next: copy dist/posture-cv into src-tauri/binaries/ with the Tauri triple suffix."
echo "E.g.: cp dist/posture-cv ../src-tauri/binaries/posture-cv-x86_64-apple-darwin"
