// Tiny synthesised sound effects (WebAudio), so the game needs no audio files.
let ctx = null, muted = false;

export function unlock() { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() { muted = !muted; return muted; }

function tone(type, f0, f1, dur, vol = 0.2, when = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq) {
  if (!ctx || muted) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = buf; f.type = 'highpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination); src.start();
}

/** Icy "shing" for a correct catch. */
export function freeze() {
  noise(0.35, 0.25, 4000);
  [1320, 1760, 2640].forEach((f, i) => tone('sine', f, f * 1.02, 0.5, 0.12, i * 0.05));
}
/** Low buzz for the wrong person. */
export function wrong() { tone('square', 160, 90, 0.28, 0.12); }
/** Click each second of the last ten. */
export function tick() { tone('triangle', 1100, 1000, 0.06, 0.15); }
/** Little fanfare at the end. */
export function end(won) { (won ? [784, 988, 1175, 1568] : [523, 440, 349]).forEach((f, i) => tone('triangle', f, f, 0.22, 0.16, i * 0.13)); }
