/**
 * Minimal Web Audio API sound effects for alerts.
 * No external audio files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(freq: number, duration: number, gain: number, type: OscillatorType = "sine") {
  const audioCtx = getCtx();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

export function playPostureAlert() {
  // Two low soft tones
  beep(220, 0.3, 0.15, "sine");
  setTimeout(() => beep(180, 0.3, 0.12, "sine"), 200);
}

export function playHandFaceAlert() {
  // Single soft mid tone
  beep(330, 0.25, 0.12, "sine");
}

export function playXpGain() {
  // Happy ascending chime
  beep(440, 0.15, 0.1, "sine");
  setTimeout(() => beep(554, 0.15, 0.1, "sine"), 100);
  setTimeout(() => beep(659, 0.2, 0.1, "sine"), 200);
}

export function playLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => beep(f, 0.3, 0.15, "sine"), i * 120)
  );
}
