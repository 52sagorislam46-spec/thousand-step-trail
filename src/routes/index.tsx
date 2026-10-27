import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CircleHelp, Lock, RotateCcw, Star, X } from "lucide-react";

import {
  buildLevelLayout,
  LEVEL_TOTAL,
  loadProgress,
  MAP_WIDTH,
  saveProgress,
  smoothPath,
  type Progress,
} from "@/lib/levels";
import { BubbleShooterGame } from "@/components/bubble-shooter/BubbleShooterGame";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "লেভেল ম্যাপ — ১০০০ লেভেল" },
      {
        name: "description",
        content: "১০০০টি লেভেলের রঙিন গেম ম্যাপ — পথ ধরে এগিয়ে যান, তারা জিতুন ও নতুন লেভেল খুলুন।",
      },
      { property: "og:title", content: "লেভেল ম্যাপ — ১০০০ লেভেল" },
      { property: "og:description", content: "১০০০টি লেভেলের রঙিন গেম ম্যাপ — পথ ধরে এগিয়ে যান!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LevelMapPage,
});

const SECTION_EVERY = 50;

const DECORATIONS: { level: number; emoji: string; side: "left" | "right" }[] = [
  { level: 60, emoji: "🎈", side: "right" },
  { level: 140, emoji: "🦋", side: "left" },
  { level: 230, emoji: "🍭", side: "right" },
  { level: 320, emoji: "🌈", side: "left" },
  { level: 420, emoji: "🎀", side: "right" },
  { level: 510, emoji: "🌟", side: "left" },
  { level: 620, emoji: "🎁", side: "right" },
  { level: 720, emoji: "🌸", side: "left" },
  { level: 830, emoji: "☁️", side: "right" },
  { level: 930, emoji: "🏆", side: "left" },
];

export function LevelMapPage() {
  const { pts, height } = useMemo(() => buildLevelLayout(), []);
  const pathD = useMemo(() => smoothPath(pts), [pts]);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [playing, setPlaying] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const nodeRefs = useRef(new Map<number, HTMLElement>());
  const [scrollTick, setScrollTick] = useState(0);
  const unlockedLevel = progress?.unlocked ?? null;

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // Keep the map positioned at the current open level (on load and after leaving a game).
  useEffect(() => {
    if (unlockedLevel === null) return;
    const go = () => {
      try {
        const el = nodeRefs.current.get(unlockedLevel);
        el?.scrollIntoView({ block: "center", behavior: "auto" });
      } catch {
        // environments without scrolling (tests)
      }
    };
    const timers = [0, 60, 250].map((ms) => window.setTimeout(go, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [unlockedLevel, scrollTick]);

  if (!progress) {
    return (
      <div className="game-bg flex min-h-screen items-center justify-center">
        <p className="text-lg font-semibold text-game-text">লোড হচ্ছে…</p>
      </div>
    );
  }

  const completeLevel = (level: number, stars: number) => {
    setProgress((prev) => {
      const base = prev ?? progress;
      const next: Progress = {
        unlocked: Math.min(LEVEL_TOTAL, Math.max(base.unlocked, level + 1)),
        stars: { ...base.stars, [level]: Math.max(base.stars[level] ?? 0, stars) },
      };
      saveProgress(next);
      return next;
    });
  };

  const resetProgress = () => {
    if (!window.confirm("সব প্রগ্রেস মুছে ফেলা হবে। আপনি কি নিশ্চিত?")) return;
    const fresh: Progress = { unlocked: 1, stars: {} };
    saveProgress(fresh);
    setProgress(fresh);
  };

  const sphereBackground = (state: "locked" | "done" | "current"): CSSProperties => {
    if (state === "locked") {
      return {
        background:
          "radial-gradient(circle at 32% 28%, var(--game-node-locked), var(--game-node-locked-deep))",
      };
    }
    if (state === "done") {
      return {
        background:
          "radial-gradient(circle at 32% 28%, var(--game-node-done), var(--game-node-done-deep))",
      };
    }
    return {
      background:
        "radial-gradient(circle at 32% 28%, var(--game-node-current), var(--game-node-current-deep))",
    };
  };

  return (
    <div className="game-bg min-h-screen text-game-text">
      <header className="sticky top-0 z-50 mx-auto flex w-full max-w-[480px] items-center justify-end gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          aria-label="সাহায্য"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-game-header/90 text-game-text shadow-lg ring-1 ring-white/15 backdrop-blur transition-transform active:scale-95"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </header>

      <main className="relative mx-auto w-full max-w-[480px]" style={{ height }}>
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${MAP_WIDTH} ${height}`}
          preserveAspectRatio="none"
        >
          <path
            d={pathD}
            fill="none"
            stroke="var(--game-path)"
            strokeWidth={54}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathD}
            fill="none"
            stroke="var(--game-path-light)"
            strokeWidth={30}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
        </svg>

        {DECORATIONS.map(({ level, emoji, side }) => {
          const pt = pts[level - 1];
          if (!pt) return null;
          const pct = (pt.x / MAP_WIDTH) * 100;
          const offset = side === "right" ? "+" : "-";
          return (
            <span
              key={level}
              aria-hidden
              className="pointer-events-none absolute -translate-y-1/2 select-none text-3xl"
              style={{ left: `calc(${pct}% ${offset} 52px)`, top: pt.y + 28 }}
            >
              {emoji}
            </span>
          );
        })}

        {Array.from({ length: LEVEL_TOTAL / SECTION_EVERY - 1 }, (_, i) => i + 1).map((group) => {
          const a = pts[group * SECTION_EVERY - 1];
          const b = pts[group * SECTION_EVERY];
          if (!a || !b) return null;
          return (
            <div
              key={group}
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-game-header/80 px-3 py-0.5 text-xs font-semibold text-white/85 backdrop-blur"
              style={{ left: "50%", top: (a.y + b.y) / 2 }}
            >
              {`লেভেল ${group * SECTION_EVERY + 1}–${(group + 1) * SECTION_EVERY}`}
            </div>
          );
        })}

        {pts.map((pt, idx) => {
          const level = idx + 1;
          const isCurrent = level === progress.unlocked;
          const isDone = level < progress.unlocked;
          const isLocked = !isCurrent && !isDone;
          const state = isCurrent ? "current" : isDone ? "done" : "locked";
          const starCount = progress.stars[level] ?? 0;

          return (
            <button
              key={level}
              type="button"
              ref={(el) => {
                if (el) nodeRefs.current.set(level, el);
                else nodeRefs.current.delete(level);
              }}
              aria-label={`লেভেল ${level}`}
              aria-current={isCurrent || undefined}
              onClick={() => {
                if (isLocked) {
                  setShake(level);
                  window.setTimeout(() => setShake((s) => (s === level ? null : s)), 350);
                } else {
                  setSelected(level);
                }
              }}
              className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center focus:outline-none"
              style={{ left: `${(pt.x / MAP_WIDTH) * 100}%`, top: pt.y }}
            >
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute -top-8 h-0 w-0 border-x-[9px] border-t-[14px] border-x-transparent border-t-game-gold drop-shadow"
                />
              )}
              <span
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold shadow-lg transition-transform active:scale-90",
                  isLocked ? "text-white/80" : "text-white",
                  shake === level && "game-shake",
                  isCurrent && "game-current-ring",
                )}
                style={sphereBackground(state)}
              >
                {isLocked ? (
                  <span className="flex flex-col items-center leading-none">
                    <Lock className="h-4 w-4" aria-hidden />
                    <span className="mt-0.5 text-sm font-extrabold">{level}</span>
                  </span>
                ) : (
                  level
                )}
              </span>
              <span aria-hidden className="-mt-1.5 h-2.5 w-11 rounded-full bg-game-base opacity-90" />
              {isDone && (
                <span data-testid={`stars-${level}`} className="mt-0.5 flex gap-0.5 text-[11px] leading-none" aria-label={`${starCount} তারা`}>
                  {[1, 2, 3].map((s) => (
                    <span key={s} className={s <= starCount ? "text-game-gold" : "text-white/25"}>
                      ★
                    </span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </main>

      {selected !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-xs rounded-3xl border-2 border-game-gold-deep/50 bg-game-header p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="বন্ধ করুন"
              onClick={() => setSelected(null)}
              className="absolute right-3 top-3 rounded-full p-1 text-white/70 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-sm font-semibold text-white/70">লেভেল</p>
            <p className="mt-1 text-6xl font-extrabold">{selected}</p>
            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    "h-7 w-7",
                    s <= (progress.stars[selected] ?? 0)
                      ? "fill-game-gold text-game-gold"
                      : "text-white/25",
                  )}
                />
              ))}
            </div>
            <p className="mt-2 text-sm text-white/70">জিতে নিন ৩টা তারা!</p>
            <button
              type="button"
              onClick={() => {
                setPlaying(selected);
                setSelected(null);
              }}
              className="mt-4 w-full rounded-2xl bg-gradient-to-b from-game-gold to-game-gold-deep px-6 py-3 text-lg font-extrabold text-game-btn-text shadow-lg transition-transform active:scale-95"
            >
              খেলুন
            </button>
          </div>
        </div>
      )}

      {playing !== null && (
        <BubbleShooterGame
          key={playing}
          level={playing}
          onWin={(stars) => completeLevel(playing, stars)}
          onClose={() => {
            setPlaying(null);
            setScrollTick((t) => t + 1);
          }}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="relative w-full max-w-xs rounded-3xl border-2 border-game-gold-deep/50 bg-game-header p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="বন্ধ করুন"
              onClick={() => setShowHelp(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-white/70 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-extrabold">কীভাবে খেলবেন</h2>
            <ul className="mt-3 list-disc space-y-2 pl-4 text-left text-sm text-white/85">
              <li>পথ ধরে ১০০০টি লেভেল — যেটা এখনো খেলা হয়নি, সেটাই আপনার বর্তমান লেভেল।</li>
              <li>লেভেলে ট্যাপ করে “খেলুন” চাপুন।</li>
              <li>বাবল ছুড়ে একই রঙের ৩টা মিলিয়ে ফাটান — সব বাবল সাফ করলে পরের লেভেল খুলবে।</li>
              <li>আপনার প্রগ্রেস ডিভাইসে সেভ থাকে।</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
