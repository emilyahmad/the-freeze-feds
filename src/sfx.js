// Sound effects (WebAudio): synthesised, except the crowd chatter, a recording in public/sounds/.
let ctx = null, muted = false;

export function unlock() { ctx ??= new AudioContext(); if (ctx.state === 'suspended') ctx.resume(); applyWalk(); }
/** Try to start audio without a gesture (allowed on some browsers / sites); resolves true if it's running. */
export async function tryStart(timeout = 300) {
  try { unlock(); } catch { return false; }
  if (ctx.state !== 'running') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, timeout))]);
  return ctx.state === 'running';
}
export function toggleMute() { muted = !muted; applyWalk(); applyMurmur(); applyBeat(); return muted; }

// Beatbox bed (public/sounds/beatbox.mp3): loops from the title screen straight through the round.
const BEAT_URL = 'sounds/beatbox.mp3', BEAT_VOL = 0.62;
let beat = null;
export function startBeatbox() {
  beat ??= Object.assign(new Audio(BEAT_URL), { loop: true, preload: 'auto' });
  applyBeat();
  const p = beat.play();
  if (p) p.catch(() => {});   // autoplay can be blocked until the first click; that click calls this again
}
function applyBeat() {
  if (!beat) return;
  beat.volume = muted ? 0 : BEAT_VOL;
}

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
const FREEZE_VOL = 0.4;   // overall loudness of the freeze sound (1 = the original, which was too loud)
export function freeze() {
  noise(0.35, 0.08 * FREEZE_VOL, 4000);
  [1320, 1760, 2640].forEach((f, i) => tone('sine', f, f * 1.02, 0.5, 0.04 * FREEZE_VOL, i * 0.05));
}
/** Low buzz for the wrong person. */
export function wrong() { tone('square', 160, 90, 0.28, 0.12); }
/** Whoosh of the snowball coming back at the player, then the wet thud when it splats on the screen. */
export function whoosh() { noise(0.45, 0.05, 1200); tone('sine', 220, 520, 0.45, 0.03); }
export function splat() { tone('sine', 150, 45, 0.28, 0.3); noise(0.22, 0.14, 250); }
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
// A recording of people talking (public/sounds/conversation-noises.mp4), with its silent lead-in and tail trimmed and
// its ends crossfaded into a seamless loop. Two copies play: the first fades in as the street starts to fill, the
// second (offset and a touch slower, so it doesn't sound like an echo) joins as it gets crowded. Level 0..1 from main.js.
const MURMUR_URL = 'sounds/conversation-noises.mp4';
const MURMUR_VOL = [0.22, 0.14];               // each copy at full
const MURMUR_RATE = [1, 0.94];                 // playback rate of each copy
const MURMUR_EASE = 0.8;                       // fade time constant (s)
const MURMUR_DUCK = 0.55, MURMUR_DUCK_EASE = 0.25;   // level during an ID check, and how fast it dips (s)
const MURMUR_XFADE = 0.5;                      // loop crossfade (s)
let murmur = null, murmurLevel = 0, murmurPending = false, murmurDucked = false;
const murmurFile = fetch(MURMUR_URL).then((r) => { if (!r.ok) throw new Error(`${MURMUR_URL}: ${r.status}`); return r.arrayBuffer(); });

/** Trim silence off both ends of `buf` and crossfade its tail into its head, so it loops without a gap or click. */
function makeLoop(buf) {
  const sr = buf.sampleRate, chans = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  const win = Math.round(sr * 0.05), loud = (i) => {        // is the 50 ms window at i above the noise floor?
    let e = 0; for (let k = i; k < i + win; k++) for (const d of chans) e += d[k] * d[k];
    return Math.sqrt(e / (win * chans.length)) > 0.01;
  };
  let start = 0, end = buf.length - win;
  while (start < end && !loud(start)) start += win;
  while (end > start && !loud(end)) end -= win;
  end += win;
  const x = Math.min(Math.round(sr * MURMUR_XFADE), Math.floor((end - start) / 3)), n = end - start - x;
  const loop = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: chans.length });
  chans.forEach((d, c) => {
    const o = loop.getChannelData(c);
    for (let i = 0; i < n; i++) o[i] = d[start + i];
    for (let i = 0; i < x; i++) {                          // equal-power: the tail fades out as the head fades in
      const k = (i / x) * Math.PI / 2;
      o[i] = d[start + i] * Math.sin(k) + d[start + n + i] * Math.cos(k);
    }
  });
  return loop;
}

async function startMurmur() {
  murmurPending = true;
  let loop;
  try { loop = makeLoop(await ctx.decodeAudioData((await murmurFile).slice(0))); }
  catch (e) { console.warn('crowd chatter unavailable:', e); return; }   // stays pending, so no retries
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  murmur = { master, layers: MURMUR_VOL.map((_, i) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = loop; src.loop = true; src.playbackRate.value = MURMUR_RATE[i]; g.gain.value = 0;
    src.connect(g).connect(master); src.start(ctx.currentTime, (i * 0.5 + Math.random() * 0.2) * loop.duration);
    return g;
  }) };
  applyMurmur();
}

function applyMurmur() {
  if (!murmur) return;
  const t = ctx.currentTime, L = murmur.layers.length;
  murmur.master.gain.setTargetAtTime(muted ? 0 : murmurDucked ? MURMUR_DUCK : 1, t, muted ? 0.05 : MURMUR_DUCK_EASE);
  murmur.layers.forEach((g, i) => {
    const want = MURMUR_VOL[i] * Math.min(1, Math.max(0, murmurLevel * L - i));
    g.gain.setTargetAtTime(want, t, MURMUR_EASE);
  });
}

/** Lower the chatter a little (during an ID check) or bring it back. */
export function duckMurmur(on) { if (on === murmurDucked) return; murmurDucked = on; applyMurmur(); }

/** How full the street is (0..1); the chatter swells to match. Call whenever it changes. */
export function crowdLevel(level) {
  level = Math.round(level * 40) / 40;                    // only re-aim the fades on real changes
  if (level === murmurLevel && (murmur || murmurPending || !level)) return;
  murmurLevel = level;
  if (!ctx || ctx.state !== 'running') return;
  if (!murmur && !murmurPending && level > 0) startMurmur();
  applyMurmur();
}
