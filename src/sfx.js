// Tiny synthesised sound effects (WebAudio), so the game needs no audio files.
let ctx = null, muted = false;

export function unlock() { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); applyWalk(); }
/** Try to start audio without a gesture (allowed on some browsers / sites); resolves true if it's running. */
export async function tryStart(timeout = 300) {
  try { unlock(); } catch { return false; }
  if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, timeout))]);
  return ctx.state === 'running';
}
export function toggleMute() { muted = !muted; applyWalk(); applyMurmur(); return muted; }

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
  noise(0.35, 0.08, 4000);
  [1320, 1760, 2640].forEach((f, i) => tone('sine', f, f * 1.02, 0.5, 0.04, i * 0.05));
}
/** Low buzz for the wrong person. */
export function wrong() { tone('square', 160, 90, 0.28, 0.12); }
/** Click each second of the last ten. */
export function tick() { tone('triangle', 1100, 1000, 0.06, 0.15); }
/** Little fanfare at the end. */
export function end(won) { (won ? [784, 988, 1175, 1568] : [523, 440, 349]).forEach((f, i) => tone('triangle', f, f, 0.22, 0.16, i * 0.13)); }

// ---- crossing signal: the accessible pedestrian signal's rapid WALK tick, looped in the background ----
// One tick period is rendered into a buffer (a short, bright electronic click) and looped, so it stays steady
// whatever the frame rate. It plays while `walkLoop(true)` and the audio is unlocked and unmuted.
const WALK_TICK_HZ = 1, WALK_VOL = 0.09, WALK_FADE = 0.08;   // ticks per second, loudness, fade in/out (s)
let walkOn = false, walkBuf = null, walkSrc = null, walkGain = null;

function tickBuffer() {
  const sr = ctx.sampleRate, n = Math.round(sr / WALK_TICK_HZ), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const t = i / sr, env = Math.exp(-t / 0.0035);
    d[i] = env * (0.6 * Math.sin(2 * Math.PI * 2100 * t) + 0.3 * Math.sin(2 * Math.PI * 3400 * t) + 0.25 * (Math.random() * 2 - 1))
      + 0.35 * Math.exp(-t / 0.012) * Math.sin(2 * Math.PI * 700 * t);   // little body under the click
  }
  return buf;
}

function applyWalk() {
  if (!ctx) return;
  const want = walkOn && !muted, t = ctx.currentTime;
  if (want && !walkSrc) {
    walkBuf ??= tickBuffer();
    walkGain = ctx.createGain(); walkGain.gain.setValueAtTime(0, t); walkGain.gain.linearRampToValueAtTime(WALK_VOL, t + WALK_FADE);
    walkSrc = ctx.createBufferSource(); walkSrc.buffer = walkBuf; walkSrc.loop = true;
    walkSrc.connect(walkGain).connect(ctx.destination); walkSrc.start(t);
  } else if (!want && walkSrc) {
    walkGain.gain.cancelScheduledValues(t); walkGain.gain.setValueAtTime(walkGain.gain.value, t);
    walkGain.gain.linearRampToValueAtTime(0, t + WALK_FADE); walkSrc.stop(t + WALK_FADE + 0.02);
    walkSrc = walkGain = null;
  }
}
/** Crossing-signal WALK tick on/off (follows the walk man in the photo; see signal.js). */
export function walkLoop(on) { walkOn = on; applyWalk(); }

// ---- crowd murmur: background chatter that swells as people reach the street ----
// Each layer is a few synthesised voices babbling (a buzzy glottal tone through vowel formant filters, chopped into
// syllables and phrases with pauses), rendered offline into a seamless loop. Layers fade in one by one as the crowd
// level (0..1, from main.js) rises, so a few people sound like a few voices and a full street like a murmur.
const MURMUR_LAYERS = 4, MURMUR_VOICES = 3;    // layers × voices per layer
const MURMUR_VOL = 0.07;                       // per layer, at full
const MURMUR_EASE = 0.8;                       // fade time constant (s)
const MURMUR_LOOP = [9.3, 10.7, 11.9, 13.1];   // loop lengths (s), unequal so the layers don't repeat together
const VOWELS = [[800, 1200, 2500], [500, 1800, 2500], [320, 2300, 3000], [500, 900, 2400], [380, 950, 2300], [650, 1500, 2500]];
let murmur = null, murmurLevel = 0, murmurPending = false;

async function renderBabble(len, seed) {
  const sr = 22050, tail = 2.5, oc = new OfflineAudioContext(1, Math.ceil((len + tail) * sr), sr);
  let s = seed * 9301 + 49297; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const r = (a, b) => a + rnd() * (b - a);
  const out = oc.createBiquadFilter(); out.type = 'lowpass'; out.frequency.value = 2200; out.Q.value = 0.5;   // a bit muffled: across the street
  out.connect(oc.destination);
  for (let v = 0; v < MURMUR_VOICES; v++) {
    const f0 = rnd() < 0.5 ? r(95, 140) : r(175, 240), level = r(0.5, 1);
    const osc = oc.createOscillator(); osc.type = 'sawtooth';
    const amp = oc.createGain(); amp.gain.value = 0;
    const forms = [0, 1, 2].map((k) => {
      const f = oc.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = [6, 9, 10][k];
      const g = oc.createGain(); g.gain.value = [1, 0.6, 0.25][k];
      osc.connect(f).connect(g).connect(amp); return f;
    });
    amp.connect(out);
    let t = r(0, 2);
    while (t < len) {                                       // phrases of syllables, with pauses between
      const syl = Math.floor(r(3, 12)); let pitch = f0 * r(0.95, 1.15);
      for (let i = 0; i < syl && t < len + tail - 0.5; i++) {
        const d = r(0.1, 0.24), vw = VOWELS[Math.floor(rnd() * VOWELS.length)];
        pitch *= r(0.94, 1.05);
        osc.frequency.setTargetAtTime(pitch, t, 0.03);
        forms.forEach((f, k) => f.frequency.setTargetAtTime(vw[k] * r(0.9, 1.1), t, 0.025));
        const pk = level * r(0.6, 1);
        amp.gain.setTargetAtTime(pk, t, 0.015); amp.gain.setTargetAtTime(pk * 0.15, t + d * 0.7, 0.02);
        t += d;
      }
      amp.gain.setTargetAtTime(0, t, 0.04);
      t += r(0.25, 1.4);
    }
    osc.frequency.setValueAtTime(f0, 0); osc.start(0);
  }
  const buf = await oc.startRendering(), d = buf.getChannelData(0), n = Math.round(len * sr);
  for (let i = n; i < d.length; i++) d[i - n] += d[i];     // fold the tail onto the start: seamless loop
  const loop = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 1 }), ld = loop.getChannelData(0);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (let i = 0; i < n; i++) ld[i] = d[i] / (peak || 1);
  return loop;
}

async function startMurmur() {
  murmurPending = true;
  const bufs = await Promise.all(MURMUR_LOOP.map((len, i) => renderBabble(len, i + 1)));
  const master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
  murmur = { master, layers: bufs.map((b) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.loop = true; g.gain.value = 0;
    src.connect(g).connect(master); src.start(ctx.currentTime, Math.random() * b.duration);
    return g;
  }) };
  applyMurmur();
}

function applyMurmur() {
  if (!murmur) return;
  const t = ctx.currentTime;
  murmur.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.05);
  murmur.layers.forEach((g, i) => {
    const want = MURMUR_VOL * Math.min(1, Math.max(0, murmurLevel * MURMUR_LAYERS - i));
    g.gain.setTargetAtTime(want, t, MURMUR_EASE);
  });
}

/** How full the street is (0..1); the chatter swells to match. Call whenever it changes. */
export function crowdLevel(level) {
  level = Math.round(level * 40) / 40;                    // only re-aim the fades on real changes
  if (level === murmurLevel && (murmur || murmurPending || !level)) return;
  murmurLevel = level;
  if (!ctx || ctx.state !== 'running') return;
  if (!murmur && !murmurPending && level > 0) startMurmur();
  applyMurmur();
}
