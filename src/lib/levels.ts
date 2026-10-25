export const LEVEL_TOTAL = 1000;
export const MAP_WIDTH = 480;

const SPACING = 116;
const TOP_PAD = 170;
const BOTTOM_PAD = 210;

// Serpentine wave: center, left, center, right — repeats like a winding path.
const XFRACTIONS = [0.5, 0.24, 0.5, 0.76];

export interface LevelPoint {
  x: number;
  y: number;
}

export function buildLevelLayout(total: number = LEVEL_TOTAL) {
  const pts: LevelPoint[] = [];
  const height = TOP_PAD + total * SPACING + BOTTOM_PAD;
  for (let i = 0; i < total; i++) {
    const f = XFRACTIONS[i % 4] ?? 0.5;
    const x = 30 + f * (MAP_WIDTH - 60) + Math.cos(i * 2.1) * 8;
    // Level 1 sits at the bottom of the map; higher levels climb upward.
    const y = height - BOTTOM_PAD - i * SPACING + Math.sin(i * 1.3) * 6;
    pts.push({ x, y });
  }
  return { pts, height };
}

/** Catmull-Rom spline converted to cubic beziers for a smooth winding road. */
export function smoothPath(pts: LevelPoint[]): string {
  if (pts.length < 2) return "";
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1]!.x.toFixed(1)} ${p[1]!.y.toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export interface Progress {
  unlocked: number;
  stars: Record<number, number>;
}

const STORAGE_KEY = "game-level-progress";

export const DEFAULT_PROGRESS: Progress = {
  unlocked: 6,
  stars: { 1: 3, 2: 3, 3: 2, 4: 2, 5: 2 },
};

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    if (typeof parsed.unlocked !== "number" || parsed.unlocked < 1) return DEFAULT_PROGRESS;
    return { unlocked: parsed.unlocked, stars: parsed.stars ?? {} };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // storage unavailable — progress stays in memory for this session
  }
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.stars).reduce((sum, n) => sum + n, 0);
}
