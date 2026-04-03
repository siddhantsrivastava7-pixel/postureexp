export default function XpToast({ amount }: { amount: number }) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-up pointer-events-none">
      <div className="flex items-center gap-2 bg-xp/20 border border-xp/40 text-xp text-sm font-bold px-4 py-2 rounded-full shadow-lg">
        <span>+{amount} XP</span>
        <span>⚡</span>
      </div>
    </div>
  );
}
