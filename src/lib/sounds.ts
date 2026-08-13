/** Synthesised meme sound effects — no audio files needed, all Web Audio. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buf = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

type ToneOpts = {
  type?: OscillatorType;
  from: number;
  to?: number;
  start?: number;
  dur: number;
  gain?: number;
};

function tone(ac: AudioContext, o: ToneOpts) {
  const t0 = ac.currentTime + (o.start ?? 0);
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to ?? o.from), t0 + o.dur);
  const peak = o.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function noise(
  ac: AudioContext,
  opts: { start?: number; dur: number; from: number; to: number; q?: number; gain?: number },
) {
  const t0 = ac.currentTime + (opts.start ?? 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, opts.dur + 0.1);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = opts.q ?? 1.2;
  filter.frequency.setValueAtTime(opts.from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), t0 + opts.dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.25, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.1);
}

const players: Record<string, (ac: AudioContext) => void> = {
  boom: (ac) => {
    tone(ac, { type: "sine", from: 120, to: 28, dur: 1.1, gain: 0.6 });
    noise(ac, { dur: 0.25, from: 400, to: 60, gain: 0.3 });
  },
  fahh: (ac) => {
    tone(ac, { type: "sawtooth", from: 620, to: 150, dur: 0.75, gain: 0.22 });
    tone(ac, { type: "square", from: 310, to: 74, dur: 0.75, gain: 0.1 });
  },
  bruh: (ac) => {
    tone(ac, { type: "square", from: 190, to: 90, dur: 0.35, gain: 0.22 });
    noise(ac, { dur: 0.3, from: 900, to: 200, gain: 0.12 });
  },
  airhorn: (ac) => {
    [0, 0.28, 0.56].forEach((s, i) => {
      tone(ac, { type: "sawtooth", from: 440, to: 430, start: s, dur: i === 2 ? 0.5 : 0.2 });
      tone(ac, { type: "sawtooth", from: 660, to: 650, start: s, dur: i === 2 ? 0.5 : 0.2 });
    });
  },
  trombone: (ac) => {
    [
      [392, 0],
      [349, 0.24],
      [311, 0.48],
      [262, 0.72],
    ].forEach(([f, s]) => tone(ac, { type: "sawtooth", from: f!, to: f! * 0.94, start: s!, dur: 0.3 }));
  },
  fart: (ac) => {
    for (let i = 0; i < 7; i++) {
      tone(ac, {
        type: "square",
        from: 90 + Math.random() * 60,
        to: 55,
        start: i * 0.055,
        dur: 0.09,
        gain: 0.18,
      });
    }
    noise(ac, { dur: 0.45, from: 260, to: 90, gain: 0.14, q: 3 });
  },
  sheesh: (ac) => {
    noise(ac, { dur: 0.85, from: 500, to: 6000, gain: 0.16, q: 2 });
  },
  crickets: (ac) => {
    for (let i = 0; i < 6; i++) {
      noise(ac, { start: i * 0.22, dur: 0.05, from: 4200, to: 5200, gain: 0.1, q: 12 });
      noise(ac, { start: i * 0.22 + 0.07, dur: 0.05, from: 4200, to: 5200, gain: 0.1, q: 12 });
    }
  },
  suspense: (ac) => {
    [0, 0.18, 0.36, 0.54].forEach((s, i) =>
      tone(ac, { type: "triangle", from: 220 * Math.pow(1.12, i), dur: 0.16, start: s, gain: 0.2 }),
    );
  },
  win: (ac) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(ac, { type: "triangle", from: f, dur: 0.22, start: i * 0.11, gain: 0.22 }),
    );
  },
};

export const MEMES = [
  { id: "boom", label: "Vine Boom", emoji: "💥" },
  { id: "fahh", label: "Fahh", emoji: "😩" },
  { id: "bruh", label: "Bruh", emoji: "🗿" },
  { id: "airhorn", label: "Airhorn", emoji: "📢" },
  { id: "trombone", label: "Sad Trombone", emoji: "🎺" },
  { id: "fart", label: "Fart", emoji: "💨" },
  { id: "sheesh", label: "Sheeesh", emoji: "🥶" },
  { id: "crickets", label: "Crickets", emoji: "🦗" },
  { id: "suspense", label: "Suspense", emoji: "😳" },
  { id: "win", label: "Victory", emoji: "🏆" },
] as const;

export type MemeId = (typeof MEMES)[number]["id"];

export const memeById = (id: string) => MEMES.find((m) => m.id === id);

export function playMeme(id: string) {
  const ac = audio();
  if (!ac) return;
  players[id]?.(ac);
}

export function playChime(kind: "pop" | "alert" = "pop") {
  const ac = audio();
  if (!ac) return;
  if (kind === "pop") tone(ac, { type: "triangle", from: 880, to: 1200, dur: 0.12, gain: 0.12 });
  else tone(ac, { type: "square", from: 300, to: 180, dur: 0.3, gain: 0.16 });
}

export function unlockAudio() {
  audio();
}
