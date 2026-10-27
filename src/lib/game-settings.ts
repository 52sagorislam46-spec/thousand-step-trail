// Sound / music preferences, saved in localStorage.
const KEY = "bubble-settings";
type S = { sound: boolean; music: boolean };
let state: S = { sound: true, music: true };
if (typeof window !== "undefined") {
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    /* ignore */
  }
}
export const getSettings = () => state;
export function setSetting(k: keyof S, v: boolean) {
  state = { ...state, [k]: v };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  if (k === "music") (v ? startMusic() : stopMusic());
}

let musicCtx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 784, 659, 587, 523];

export function startMusic() {
  if (typeof window === "undefined" || !state.music || timer) return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  musicCtx ??= new AC();
  if (musicCtx.state === "suspended") void musicCtx.resume();
  let i = 0;
  timer = setInterval(() => {
    const c = musicCtx!;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = MELODY[i++ % MELODY.length];
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.32);
  }, 320);
}
export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = null;
}
