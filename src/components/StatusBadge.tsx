import { PostureStatus, HandFaceStatus } from "../types";

interface PostureBadgeProps {
  status: PostureStatus;
  label?: string;
}

export function PostureBadge({ status, label = "Posture" }: PostureBadgeProps) {
  const text =
    status === "good" ? "Good" : status === "warning" ? "Warning" : "Unknown";
  const cls =
    status === "good"
      ? "badge-good"
      : status === "warning"
      ? "badge-warning"
      : "badge-unknown";
  return (
    <span className={cls}>
      {label}: {text}
    </span>
  );
}

interface HandFaceBadgeProps {
  status: HandFaceStatus;
}

export function HandFaceBadge({ status }: HandFaceBadgeProps) {
  const text =
    status === "clean" ? "Clean" : status === "warning" ? "Near Face" : "Unknown";
  const cls =
    status === "clean"
      ? "badge-good"
      : status === "warning"
      ? "badge-warning"
      : "badge-unknown";
  return <span className={cls}>Hand: {text}</span>;
}
