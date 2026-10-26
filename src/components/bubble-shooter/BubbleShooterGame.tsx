import { useEffect, useRef, useState } from "react";
import { RotateCcw, Star, X } from "lucide-react";

import {
  BUBBLE_COLORS,
  generateLevel,
  GRID_COLS,
  GRID_ROWS,
  neighbors,
  resolveShot,
  starsFor,
  type Grid,
} from "@/lib/bubble-generator";
import { sfx } from "@/lib/bubble-sounds";

const R = 16;
const ROW_H = R * Math.sqrt(3);
const W = GRID_COLS * 2 * R + R;
const H = 600;
const BASE_X = W / 2;
const BASE_Y = H - 44;
const BASE_R = 34;
const LAUNCH_Y = BASE_Y - 34;
const SPEED = 26;

const cellX = (r: number, c: number) => R + c * 2 * R + (r % 2 ? R : 0);
const cellY = (r: number) => R + r * ROW_H;

interface Props {
  level: number;
  onWin: (stars: number) => void;
  onClose: () => void;
}

type Status = "playing" | "won" | "lost";

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: number,
  alpha = 1,
  scale = 1,
) {
  const rr = R * scale;
  const col = BUBBLE_COLORS[color]!;
  const g = ctx.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr);
  g.addColorStop(0, col.light);
  g.addColorStop(0.45, col.base);
  g.addColorStop(1, col.dark);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, rr - 0.8, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - rr * 0.35, y - rr * 0.42, rr * 0.32, rr * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** The cannon base: dark circle, shot count in the middle, rotating swap arrows around it. */
function drawBase(ctx: CanvasRenderingContext2D, shots: number, t: number) {
  ctx.save();
  const g = ctx.createRadialGradient(BASE_X, BASE_Y, 4, BASE_X, BASE_Y, BASE_R);
  g.addColorStop(0, "#4c3f9e");
  g.addColorStop(1, "#241c55");
  ctx.beginPath();
  ctx.arc(BASE_X, BASE_Y, BASE_R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // shot count
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `bold ${BASE_R * 0.62}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(shots), BASE_X, BASE_Y + 1);

  // rotating swap arrows around the ring
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  for (let i = 0; i < 3; i++) {
    const a0 = t * 1.4 + (i * Math.PI * 2) / 3;
    const a1 = a0 + 1.25;
    ctx.beginPath();
    ctx.arc(BASE_X, BASE_Y, BASE_R, a0, a1);
    ctx.stroke();
    // arrowhead at the end of the arc
    const ax = BASE_X + Math.cos(a1) * BASE_R;
    const ay = BASE_Y + Math.sin(a1) * BASE_R;
    const tang = a1 + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(tang) * 7, ay + Math.sin(tang) * 7);
    ctx.lineTo(ax + Math.cos(tang + 2.4) * 7, ay + Math.sin(tang + 2.4) * 7);
    ctx.lineTo(ax + Math.cos(tang - 2.4) * 7, ay + Math.sin(tang - 2.4) * 7);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
  }
  ctx.restore();
}

function boardColors(grid: Grid) {
  const s = new Set<number>();
  for (const row of grid) for (const v of row) if (v != null) s.add(v);
  return [...s];
}

export function BubbleShooterGame({ level, onWin, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [shotsLeft, setShotsLeft] = useState(0);
  const [totalShots, setTotalShots] = useState(1);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    const cfg = generateLevel(level);
    const grid: Grid = cfg.grid.map((row) => [...row]);
    let shots = cfg.shots;
    setTotalShots(cfg.shots);
    setShotsLeft(shots);
    setStatus("playing");

    const pick = () => {
      const cols = boardColors(grid);
      return cols[Math.floor(Math.random() * cols.length)] ?? 0;
    };
    let current = pick();
    let next = pick();
    let aim = -Math.PI / 2;
    let aiming = false;
    let downX = 0;
    let downY = 0;
    let downT = 0;
    let ball: { x: number; y: number; vx: number; vy: number; color: number } | null = null;
    let falling: { x: number; y: number; vy: number; color: number; a: number }[] = [];
    let done = false;
    let raf = 0;
    let lastBounce = 0;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d") ?? null;
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
    };
    const setAim = (e: PointerEvent) => {
      const p = toLocal(e);
      let a = Math.atan2(p.y - LAUNCH_Y, p.x - BASE_X);
      if (a > 0) a = p.x < BASE_X ? -Math.PI + 0.15 : -0.15;
      aim = Math.min(-0.15, Math.max(-Math.PI + 0.15, a));
    };
    const down = (e: PointerEvent) => {
      if (done) return;
      const p = toLocal(e);
      downX = p.x;
      downY = p.y;
      downT = performance.now();
      aiming = true;
      setAim(e);
    };
    const move = (e: PointerEvent) => { if (aiming) setAim(e); };
    const up = (e: PointerEvent) => {
      if (!aiming) return;
      aiming = false;
      const p = toLocal(e);
      // A quick tap on the cannon base swaps current <-> next without firing.
      const isTap = Math.hypot(p.x - downX, p.y - downY) < 12 && performance.now() - downT < 400;
      if (isTap && Math.hypot(p.x - BASE_X, p.y - BASE_Y) < BASE_R + 14) {
        if (!ball && !done) {
          const t = current;
          current = next;
          next = t;
          aim = -Math.PI / 2;
          sfx.swap();
        }
        return;
      }
      setAim(e);
      if (ball || done || shots <= 0) return;
      ball = { x: BASE_X, y: LAUNCH_Y, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED, color: current };
      sfx.shoot();
      shots--;
      setShotsLeft(shots);
      current = next;
      next = pick();
    };
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    const finish = (s: Status) => {
      done = true;
      setStatus(s);
      if (s === "won") {
        const st = starsFor(shots, cfg.shots);
        setEarned(st);
        sfx.win();
        onWinRef.current(st);
      } else {
        sfx.lose();
      }
    };

    const snap = (x: number, y: number) => {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) {
          if (grid[r]![c] != null) continue;
          const attached = r === 0 || neighbors(r, c).some(([nr, nc]) => grid[nr]![nc] != null);
          if (!attached) continue;
          const d = Math.hypot(cellX(r, c) - x, cellY(r) - y);
          if (d < bd) { bd = d; best = [r, c]; }
        }
      return best;
    };

    const land = (b: NonNullable<typeof ball>) => {
      const cell = snap(b.x, b.y);
      if (!cell) return;
      const [r, c] = cell;
      grid[r]![c] = b.color;
      const snapshot = grid.map((row) => [...row]);
      const { popped, dropped } = resolveShot(grid, r, c);
      for (const [pr, pc] of [...popped, ...dropped])
        falling.push({ x: cellX(pr, pc), y: cellY(pr), vy: -2 + Math.random() * 2, color: snapshot[pr]![pc] ?? 0, a: 1 });
      if (popped.length > 0) sfx.pop(popped.length + dropped.length);
      if (boardColors(grid).length === 0) return finish("won");
      if (grid[GRID_ROWS - 1]!.some((v) => v != null)) return finish("lost");
      const cols = boardColors(grid);
      if (!cols.includes(current)) current = pick();
      if (!cols.includes(next)) next = pick();
      if (shots <= 0) finish("lost");
    };

    const step = () => {
      const now = performance.now();
      if (ball) {
        for (let i = 0; i < 4 && ball; i++) {
          ball.x += ball.vx / 4;
          ball.y += ball.vy / 4;
          if (ball.x < R) { ball.x = R; ball.vx *= -1; }
          if (ball.x > W - R) { ball.x = W - R; ball.vx *= -1; }
          if ((ball.vx < 0 && ball.x <= R + 1) || (ball.vx > 0 && ball.x >= W - R - 1)) {
            if (now - lastBounce > 70) { lastBounce = now; sfx.bounce(); }
          }
          let hit = ball.y <= R;
          if (!hit)
            outer: for (let r = 0; r < GRID_ROWS; r++)
              for (let c = 0; c < GRID_COLS; c++)
                if (grid[r]![c] != null && Math.hypot(cellX(r, c) - ball.x, cellY(r) - ball.y) < 2 * R * 0.85) { hit = true; break outer; }
          if (hit) { const b = ball; ball = null; land(b); }
        }
      }
      falling = falling.filter((f) => { f.vy += 0.6; f.y += f.vy; f.a -= 0.03; return f.y < H + R && f.a > 0; });

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, cellY(GRID_ROWS - 1) - R, W, 2);
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) {
          const v = grid[r]![c];
          if (v != null) drawBubble(ctx, cellX(r, c), cellY(r), v);
        }
      for (const f of falling) drawBubble(ctx, f.x, f.y, f.color, Math.max(0, f.a));

      drawBase(ctx, shots, now / 1000);

      if (!done) {
        // full aim guide: simulate path (wall bounces) until it hits a bubble or the top
        let x = BASE_X, y = LAUNCH_Y, dx = Math.cos(aim), dy = Math.sin(aim);
        const pts: { x: number; y: number }[] = [];
        let dist = 0;
        for (let i = 0; i < 2000; i++) {
          x += dx * 3; y += dy * 3; dist += 3;
          if (x < R) { x = R; dx = -dx; }
          if (x > W - R) { x = W - R; dx = -dx; }
          let stop = y <= R;
          if (!stop)
            outer2: for (let r = 0; r < GRID_ROWS; r++)
              for (let c = 0; c < GRID_COLS; c++)
                if (grid[r]![c] != null && Math.hypot(cellX(r, c) - x, cellY(r) - y) < 2 * R * 0.85) { stop = true; break outer2; }
          if (stop) break;
          if (dist >= 18 && Math.round(dist) % 18 === 0) pts.push({ x, y });
        }
        const col = BUBBLE_COLORS[current]!;
        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = col.base;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, R - 1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (ball) drawBubble(ctx, ball.x, ball.y, ball.color);
      else if (!done) drawBubble(ctx, BASE_X, LAUNCH_Y, current, 1, 1.15);
      if (!done) drawBubble(ctx, BASE_X + 34, BASE_Y + 20, next, 0.95, 0.85);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [level, attempt]);

  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;

  return (
    <div role="dialog" aria-label={`বাবল শুটার লেভেল ${level}`} className="game-bg fixed inset-0 z-[200] flex flex-col items-center text-game-text">
      <div className="flex w-full max-w-[480px] items-center justify-between px-3 py-2">
        <button type="button" aria-label="বন্ধ করুন" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-game-header/90 shadow-lg ring-1 ring-white/15">
          <X className="h-5 w-5" />
        </button>
        <p className="text-lg font-extrabold">লেভেল {level}</p>
        <p className="rounded-xl bg-game-header/90 px-3 py-2 text-sm font-bold shadow-lg ring-1 ring-white/15">
          শট: {shotsLeft}
        </p>
      </div>
      <div className="flex w-full max-w-[480px] flex-1 items-start justify-center px-2">
        <canvas
          ref={canvasRef}
          className="max-h-[calc(100vh-120px)] w-full touch-none rounded-2xl bg-game-header/40 ring-1 ring-white/10"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
      </div>
      <p className="pb-2 text-center text-xs font-semibold text-white/70">
        টেনে নিশানা দিয়ে ছাড়ুন • গোল বেসে ট্যাপ করলে বাবল বদলাবে
      </p>

      {status !== "playing" && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-3xl border-2 border-game-gold-deep/50 bg-game-header p-6 text-center shadow-2xl">
            <p className="text-3xl font-extrabold">{status === "won" ? "জিতেছেন! 🎉" : "শট শেষ!"}</p>
            {status === "won" && (
              <div className="mt-3 flex justify-center gap-1">
                {[1, 2, 3].map((s) => (
                  <Star key={s} className={s <= earned ? "h-8 w-8 fill-game-gold text-game-gold" : "h-8 w-8 text-white/25"} />
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-white/70">
              {status === "won" ? `লেভেল ${level + 1} খুলে গেছে!` : "আবার চেষ্টা করুন।"}
            </p>
            <button
              type="button"
              onClick={() => (status === "won" ? onClose() : setAttempt((a) => a + 1))}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-game-gold to-game-gold-deep px-6 py-3 text-lg font-extrabold text-game-btn-text shadow-lg active:scale-95"
            >
              {status === "won" ? "ম্যাপে ফিরুন" : (<><RotateCcw className="h-5 w-5" /> আবার খেলুন</>)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
