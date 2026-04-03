import { AchievementDetail } from "../types";
import { useStore } from "../lib/store";
import { playLevelUp } from "../lib/sounds";
import { useEffect } from "react";

export default function AchievementPopup({ achievement }: { achievement: AchievementDetail }) {
  const { state } = useStore();

  useEffect(() => {
    if (state.settings.sound_alerts) playLevelUp();
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="card border-xp/30 bg-surface-card w-72 flex items-center gap-4 p-4 shadow-2xl">
        <div className="text-4xl">{achievement.icon}</div>
        <div>
          <div className="text-[10px] font-bold text-xp uppercase tracking-widest">Achievement Unlocked</div>
          <div className="text-sm font-bold text-white mt-0.5">{achievement.name}</div>
          <div className="text-xs text-surface-muted mt-0.5">{achievement.desc}</div>
        </div>
      </div>
    </div>
  );
}
