// Deterministic bubble-shooter level generator for levels 1–1000.
export const GRID_COLS = 11;
export const GRID_ROWS = 15; // a bubble landing on the last row = game over

export const BUBBLE_COLORS = [
  { base: "#e8262b", light: "#ff8a7a", dark: "#8a0b10" }, // red
  { base: "#2f8cf0", light: "#9ad2ff", dark: "#0b3f8a" }, // blue
  { base: "#f6b80c", light: "#fff09a", dark: "#a8620a" }, // yellow
  { base: "#2fc22a", light: "#b5ff8a", dark: "#0f6b12" }, // green
  { base: "#b42ee0", light: "#f0a0ff", dark: "#5c0a82" }, // purple
  { base: "#1fd0d8", light: "#b0fbff", dark: "#0a6f78" }, // cyan
] as const;

export type Grid = (number | null)[][];

export interface LevelConfig {
  level: number;
  colors: number;
  rows: number;
  shots: number;
  grid: Grid;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function colorCountFor(level: number) {
  if (level <= 3) return 2;
  if (level <= 10) return 3;
  if (level <= 30) return 4;
  if (level <= 100) return 5;
  return 6;
}

export function rowCountFor(level: number) {
  return Math.min(3 + Math.floor((level - 1) / 4), 10);
}

type Pattern = (r: number, c: number, rows: number) => number;

const PATTERNS: Pattern[] = [
  (r) => r, // horizontal stripes
  (_r, c) => Math.floor(c / 2), // vertical bands
  (r, c, rows) => Math.floor((Math.abs(c - 5) + Math.abs(r - rows / 2)) / 1.5), // diamond
  (r, c) => Math.floor(Math.hypot(c - 5 + (r % 2) * 0.5, (r - 3) * 0.87) / 1.3), // rings / flower
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 + Math.floor(c / 6) * 2, // blocks
  (r, c) => Math.floor((Math.abs(c - 5) + r) / 2), // triangle / star arms
  (r, c) => {
    // star: arms + core
    const dx = c - 5 + (r % 2) * 0.5;
    const dy = (r - 4) * 0.87;
    const ang = Math.atan2(dy, dx);
    const d = Math.hypot(dx, dy);
    const arm = Math.abs(Math.cos(ang * 2.5));
    return d < 1.5 ? 0 : arm > 0.6 ? 1 : 2 + (d > 3.5 ? 1 : 0);
  },
];

export function generateLevel(level: number): LevelConfig {
  const colors = colorCountFor(level);
  const rows = rowCountFor(level);
  const rand = rng(level * 9973 + 17);
  // early levels use simple stripes; later ones unlock fancier shapes
  const available = level <= 5 ? 2 : level <= 25 ? 4 : PATTERNS.length;
  const pattern = PATTERNS[Math.floor(rand() * available)]!;
  const palette = Array.from({ length: BUBBLE_COLORS.length }, (_, i) => i)
    .sort(() => rand() - 0.5)
    .slice(0, colors);

  const grid: Grid = Array.from({ length: GRID_ROWS }, () => Array<number | null>(GRID_COLS).fill(null));
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const idx = Math.abs(pattern(r, c, rows)) % colors;
      grid[r]![c] = palette[idx]!;
      count++;
    }
  }
  // One shot can pop/drop many bubbles, so the budget is well below the bubble count
  // and shrinks as levels go up.
  const k = Math.max(0.28, 0.6 - (level - 1) * 0.005);
  const shots = Math.max(12, Math.round(count * k));
  return { level, colors, rows, shots, grid };
}

export function starsFor(shotsLeft: number, totalShots: number) {
  const ratio = shotsLeft / totalShots;
  if (ratio >= 0.4) return 3;
  if (ratio >= 0.2) return 2;
  return 1;
}

export function neighbors(r: number, c: number): [number, number][] {
  const odd = r % 2 === 1;
  const d = odd
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];
  return d
    .map(([dr, dc]) => [r + dr!, c + dc!] as [number, number])
    .filter(([rr, cc]) => rr >= 0 && rr < GRID_ROWS && cc >= 0 && cc < GRID_COLS);
}

/** Pops a same-color cluster (≥3) at (r,c) and any bubbles left floating. Returns removed cells. */
export function resolveShot(grid: Grid, r: number, c: number) {
  const color = grid[r]![c];
  const popped: [number, number][] = [];
  const dropped: [number, number][] = [];
  if (color == null) return { popped, dropped };
  const seen = new Set<string>([`${r},${c}`]);
  const stack: [number, number][] = [[r, c]];
  while (stack.length) {
    const cur = stack.pop()!;
    popped.push(cur);
    for (const [nr, nc] of neighbors(cur[0], cur[1])) {
      const key = `${nr},${nc}`;
      if (!seen.has(key) && grid[nr]![nc] === color) {
        seen.add(key);
        stack.push([nr, nc]);
      }
    }
  }
  if (popped.length < 3) return { popped: [], dropped };
  for (const [pr, pc] of popped) grid[pr]![pc] = null;
  // anything not connected to the ceiling falls
  const anchored = new Set<string>();
  const q: [number, number][] = [];
  for (let cc = 0; cc < GRID_COLS; cc++) if (grid[0]![cc] != null) { anchored.add(`0,${cc}`); q.push([0, cc]); }
  while (q.length) {
    const [qr, qc] = q.shift()!;
    for (const [nr, nc] of neighbors(qr, qc)) {
      const key = `${nr},${nc}`;
      if (!anchored.has(key) && grid[nr]![nc] != null) { anchored.add(key); q.push([nr, nc]); }
    }
  }
  for (let rr = 0; rr < GRID_ROWS; rr++)
    for (let cc = 0; cc < GRID_COLS; cc++)
      if (grid[rr]![cc] != null && !anchored.has(`${rr},${cc}`)) {
        dropped.push([rr, cc]);
        grid[rr]![cc] = null;
      }
  return { popped, dropped };
}
