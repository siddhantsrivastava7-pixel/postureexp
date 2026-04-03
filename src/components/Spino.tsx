/**
 * Spino — the PostureXP mascot.
 * A cute cartoon spine character rendered as inline SVG.
 * Moods: happy (good posture), slouchy (warning), idle (unknown/paused).
 */

import { PostureStatus } from "../types";

interface SpinoProps {
  posture: PostureStatus;
  monitoring: boolean;
  size?: number;
}

export default function Spino({ posture, monitoring, size = 80 }: SpinoProps) {
  const mood = !monitoring ? "idle" : posture === "good" ? "happy" : posture === "warning" ? "slouchy" : "idle";

  const bodyColor    = mood === "happy" ? "#22c55e" : mood === "slouchy" ? "#f59e0b" : "#6b7280";
  const eyeColor     = "#1a1d27";
  const cheekColor   = mood === "happy" ? "#bbf7d0" : mood === "slouchy" ? "#fde68a" : "#9ca3af";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={mood === "happy" ? "animate-[bounce_2s_ease-in-out_infinite]" : mood === "slouchy" ? "animate-wiggle" : ""}
      style={{ filter: mood === "happy" ? "drop-shadow(0 0 8px rgba(34,197,94,0.4))" : "none" }}
    >
      {/* Body — stack of vertebrae */}
      {mood === "slouchy" ? (
        // Slouched curve
        <>
          <ellipse cx="40" cy="55" rx="12" ry="7" fill={bodyColor} opacity="0.9"/>
          <ellipse cx="38" cy="45" rx="10" ry="6" fill={bodyColor} opacity="0.85"/>
          <ellipse cx="36" cy="36" rx="9"  ry="6" fill={bodyColor} opacity="0.8"/>
          <ellipse cx="35" cy="27" rx="8"  ry="5" fill={bodyColor} opacity="0.75"/>
        </>
      ) : (
        // Upright stack
        <>
          <ellipse cx="40" cy="55" rx="12" ry="7" fill={bodyColor} opacity="0.9"/>
          <ellipse cx="40" cy="45" rx="10" ry="6" fill={bodyColor} opacity="0.85"/>
          <ellipse cx="40" cy="36" rx="9"  ry="6" fill={bodyColor} opacity="0.8"/>
          <ellipse cx="40" cy="27" rx="8"  ry="5" fill={bodyColor} opacity="0.75"/>
        </>
      )}

      {/* Head */}
      <ellipse
        cx={mood === "slouchy" ? 34 : 40}
        cy={mood === "slouchy" ? 18 : 17}
        rx="14" ry="12"
        fill={bodyColor}
      />

      {/* Eyes */}
      {mood === "happy" ? (
        // Happy ^^ eyes
        <>
          <path d="M 32 15 Q 34 12 36 15" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" fill="none"
            transform=""/>
          <path d="M 42 15 Q 44 12 46 15" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" fill="none"/>
        </>
      ) : mood === "slouchy" ? (
        // Worried eyes
        <>
          <ellipse cx="29" cy="16" rx="3" ry="2.5" fill={eyeColor}/>
          <ellipse cx="39" cy="16" rx="3" ry="2.5" fill={eyeColor}/>
          <path d="M 27 13 L 31 15" stroke={eyeColor} strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M 37 13 L 41 15" stroke={eyeColor} strokeWidth="1.5" strokeLinecap="round"/>
        </>
      ) : (
        // Neutral dot eyes
        <>
          <ellipse cx="36" cy="16" rx="2.5" ry="2.5" fill={eyeColor}/>
          <ellipse cx="44" cy="16" rx="2.5" ry="2.5" fill={eyeColor}/>
        </>
      )}

      {/* Mouth */}
      {mood === "happy" ? (
        <path d="M 36 22 Q 40 27 44 22" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" fill="none"/>
      ) : mood === "slouchy" ? (
        <path d="M 30 23 Q 34 20 38 23" stroke={eyeColor} strokeWidth="2" strokeLinecap="round" fill="none"/>
      ) : (
        <path d="M 37 21 L 43 21" stroke={eyeColor} strokeWidth="1.5" strokeLinecap="round"/>
      )}

      {/* Cheeks */}
      {mood === "happy" && (
        <>
          <ellipse cx="30" cy="21" rx="4" ry="2.5" fill={cheekColor} opacity="0.6"/>
          <ellipse cx="50" cy="21" rx="4" ry="2.5" fill={cheekColor} opacity="0.6"/>
        </>
      )}

      {/* Little arms */}
      <line
        x1={mood === "slouchy" ? 26 : 28} y1="42"
        x2={mood === "slouchy" ? 18 : 20} y2="50"
        stroke={bodyColor} strokeWidth="5" strokeLinecap="round"
      />
      <line
        x1={mood === "slouchy" ? 48 : 52} y1="42"
        x2={mood === "slouchy" ? 56 : 60} y2="50"
        stroke={bodyColor} strokeWidth="5" strokeLinecap="round"
      />

      {/* Stars when happy */}
      {mood === "happy" && (
        <>
          <text x="58" y="20" fontSize="10" fill="#facc15">✦</text>
          <text x="14" y="25" fontSize="8"  fill="#a78bfa">✦</text>
        </>
      )}

      {/* Zzz when idle */}
      {mood === "idle" && (
        <text x="52" y="14" fontSize="10" fill="#6b7280" opacity="0.7">z</text>
      )}
    </svg>
  );
}
