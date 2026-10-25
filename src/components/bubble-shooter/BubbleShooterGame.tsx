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

const R = 16;
const ROW_H = R * Math.sqrt(3);
const W = GRID_COLS * 2 * R + R;
const H = 600;
const SHOOT_Y = H - 40;
const SPEED = 14;

const cellX = (r: number, c: number) => R + c * 2 * R + (r % 2 ? R : 0);
const cellY = (r: number) => R + r * ROW_H;

interface Props {
  level: number;
  onWin: (stars: number) => void;
  onClose: () => void;
}

type Status = "playing" | "won" | "lost";

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, color: number, alpha = 1) {
  const col = BUBBLE_COLORS[color]!;
  const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
  g.addColorStop(0, col.light);
  g.addColorStop(0.45, col.base);
  g.addColorStop(1, col.dark);
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, R - 0.8, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - R * 0.35, y - R * 0.42, R * 0.32, R * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();
  ctx.globalAlpha = 1;
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
    let ball: { x: number; y: number; vx: number; vy: number; color: number } | null = null;
    let falling: { x: number; y: number; vy: number; color: number; a: number }[] = [];
    let done = false;
    let raf = 0;

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
      let a = Math.atan2(p.y - SHOOT_Y, p.x - W / 2);
      if (a > 0) a = p.x < W / 2 ? -Math.PI + 0.15 : -0.15;
      aim = Math.min(-0.15, Math.max(-Math.PI + 0.15, a));
    };
    const down = (e: PointerEvent) => { if (done) return; aiming = true; setAim(e); };
    const move = (e: PointerEvent) => { if (aiming) setAim(e); };
    const up = (e: PointerEvent) => {
      if (!aiming) return;
      aiming = false;
      setAim(e);
      if (ball || done || shots <= 0) return;
      ball = { x: W / 2, y: SHOOT_Y, vx: Math.cos(aim) * SPEED, vy: Math.sin(aim) * SPEED, color: current };
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
        onWinRef.current(st);
      }
    };

    const snap = (x: number, y: number) => {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) {
          if (grid[r]![c] != null) continue;
          if (r % 2 === 1 && c === GRID_COLS - 1) continue;
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
      const { popped, dropped } = resolveShot(grid, r, c);
      for (const [pr, pc] of [...popped, ...dropped])
        falling.push({ x: cellX(pr, pc), y: cellY(pr), vy: -2 + Math.random() * 2, color: popped.length ? b.color : 0, a: 1 });
      // fix colors of falling bubbles (resolveShot already cleared them)
      if (boardColors(grid).length === 0) return finish("won");
      if (grid[GRID_ROWS - 1]!.some((v) => v != null)) return finish("lost");
      const cols = boardColors(grid);
      if (!cols.includes(current)) current = pick();
      if (!cols.includes(next)) next = pick();
      if (shots <= 0) finish("lost");
    };

    const step = () => {
      if (ball) {
        for (let i = 0; i < 2 && ball; i++) {
          ball.x += ball.vx / 2;
          ball.y += ball.vy / 2;
          if (ball.x < R) { ball.x = R; ball.vx *= -1; }
          if (ball.x > W - R) { ball.x = W - R; ball.vx *= -1; }
          let hit = ball.y <= R;
          if (!hit)
            outer: for (let r = 0; r < GRID_ROWS; r++)
              for (let c = 0; c < GRID_COLS; c++)
                if (grid[r]![c] != null && Math.hypot(cellX(r, c) - ball.x, cellY(r) - ball.y) < 2 * R * 0.85) { hit = true; break outer; }
          if (hit) { const b = ball; ball = null; land(b); }
        }
      }
      falling = falling.filter((f) => { f.vy += 0.5; f.y += f.vy; f.a -= 0.02; return f.y < H + R && f.a > 0; });

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, cellY(GRID_ROWS - 1) - R, W, 2);
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) {
          const v = grid[r]![c];
          if (v != null) drawBubble(ctx, cellX(r, c), cellY(r), v);
        }
      for (const f of falling) drawBubble(ctx, f.x, f.y, f.color, Math.max(0, f.a));

      if (!done) {
        // aim guide with one wall bounce
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        let x = W / 2, y = SHOOT_Y, dx = Math.cos(aim), dy = Math.sin(aim);
        ctx.moveTo(x, y);
        for (let i = 0; i < 2; i++) {
          const tx = dx < 0 ? (R - x) / dx : (W - R - x) / dx;
          const ty = (R - y) / dy;
          const t = Math.min(tx, ty, 260);
          x += dx * t; y += dy * t;
          ctx.lineTo(x, y);
          if (t !== tx) break;
          dx = -dx;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (ball) drawBubble(ctx, ball.x, ball.y, ball.color);
      else if (!done) drawBubble(ctx, W / 2, SHOOT_Y, current);
      if (!done) drawBubble(ctx, W / 2 - 60, SHOOT_Y + 10, next, 0.85);
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
          className="max-h-[calc(100vh-80px)] w-full touch-none rounded-2xl bg-game-header/40 ring-1 ring-white/10"
          style={{ aspectRatio: `${W} / ${H}` }}
        />
      </div>

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
