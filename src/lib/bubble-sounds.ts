// Simple WebAudio sound effects for the bubble shooter. No external files needed.
let audio: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audio) audio = new AC();
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

interface BlipOpts {
  type?: OscillatorType;
  vol?: number;
  slideTo?: number;
  delay?: number;
}

function blip(c: AudioContext, freq: number, dur: number, opts: BlipOpts = {}) {
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(opts.vol ?? 0.15, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export const sfx = {
  shoot() {
    const c = ac();
    if (!c) return;
    blip(c, 500, 0.13, { type: "triangle", slideTo: 170, vol: 0.13 });
  },
  bounce() {
    const c = ac();
    if (!c) return;
    blip(c, 230, 0.05, { type: "sine", vol: 0.07 });
  },
  pop(count: number) {
    const c = ac();
    if (!c) return;
    const n = Math.min(Math.max(count, 1), 8);
    for (let i = 0; i < n; i++)
      blip(c, 520 + i * 70, 0.09, { type: "square", vol: 0.08, delay: i * 0.05 });
  },
  swap() {
    const c = ac();
    if (!c) return;
    blip(c, 420, 0.06, { type: "triangle", vol: 0.1 });
    blip(c, 640, 0.06, { type: "triangle", vol: 0.1, delay: 0.07 });
  },
  win() {
    const c = ac();
    if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      blip(c, f, 0.18, { type: "triangle", vol: 0.13, delay: i * 0.12 }),
    );
  },
  lose() {
    const c = ac();
    if (!c) return;
    [330, 262, 196].forEach((f, i) =>
      blip(c, f, 0.2, { type: "sawtooth", vol: 0.09, delay: i * 0.14 }),
    );
  },
};
