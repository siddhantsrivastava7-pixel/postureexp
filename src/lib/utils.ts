export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function xpForNextLevel(level: number): number {
  return level * 200;
}

export function xpProgress(totalXp: number, level: number): number {
  const levelStart = (level - 1) * 200;
  const levelEnd   = level * 200;
  return Math.min(100, ((totalXp - levelStart) / (levelEnd - levelStart)) * 100);
}

export function clsx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
