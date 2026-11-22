// Snowball throw by webcam: the player mimes a real throw. They make a fist (holding the snowball), bring it toward the
// camera, and open their hand to show their palm as it gets close (letting go of the ball).
// MediaPipe's HandLandmarker (runtime + model served from public/mediapipe/, so no CDN) tracks the hand each video
// frame. Fist = at least FIST_FINGERS of the four fingertips curled in toward the wrist; open = at least OPEN_FINGERS
// straightened out past their middle joints (both on the 3D world landmarks, so distance doesn't matter). Once a fist is
// held FIST_HOLD s the throw is armed and the palm's on-screen size (wrist→knuckles and knuckle width, which barely
// change as the fingers open) is tracked; the hand opening after it has grown PUSH× within PUSH_WINDOW s is the throw.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const PUSH = 1.3;             // how much bigger the hand must get on screen (coming at the lens) before it opens
const PUSH_WINDOW = 1.0;      // ...within this many seconds
const FIST_FINGERS = 3;       // curled fingertips (of index/middle/ring/pinky) needed for a fist
const OPEN_FINGERS = 3;       // straightened fingers needed for an open palm
const OPEN_STRAIGHT = 1.15;   // a finger is straight when its tip is this much farther from the wrist than its middle joint
const FIST_HOLD = 0.12;       // the fist must be held this long (s) to arm the throw
const OPEN_EARLY = 0.3;       // an open hand that hasn't come close enough disarms after this long (s): make a fist again
const CHARGE_MAX = 0.85;      // the meter fills to here with the push; the open palm fills the rest
const LOST_GRACE = 0.25;      // a hand that drops out for less than this (s) keeps its history
const LOST_THROW = 1.25;      // if the hand vanishes mid-push (too close / too fast) at this growth, it still counts

const asset = (p) => new URL(p, document.baseURI).href;
const FINGERS = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];   // mcp, pip, tip landmark indices

let landmarkerP = null;
/** Load the hand tracker once (GPU if it can, else CPU). Safe to call early to warm it up. */
export function preloadHands() {
  landmarkerP ??= (async () => {
    const files = await FilesetResolver.forVisionTasks(asset('mediapipe/wasm'));
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: asset('mediapipe/hand_landmarker.task'), delegate },
      runningMode: 'VIDEO', numHands: 2,
    });
    try { return await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch { return await HandLandmarker.createFromOptions(files, opts('CPU')); }
  })();
  landmarkerP.catch(() => { landmarkerP = null; });   // let a later open() retry
  return landmarkerP;
}

const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function isFist(world) {
  const w = world[0];
  return FINGERS.filter(([, pip, tip]) => d3(world[tip], w) < d3(world[pip], w)).length >= FIST_FINGERS;
}
function isOpen(world) {
  const w = world[0];
  return FINGERS.filter(([, pip, tip]) => d3(world[tip], w) > d3(world[pip], w) * OPEN_STRAIGHT).length >= OPEN_FINGERS;
}
/** The palm's size on screen (px): the longer of wrist→middle knuckle and index→pinky knuckle, which stay about the
 *  same whether the fingers are curled or open, so the hand opening doesn't read as it coming closer. */
function palmSize(lm, W, H) {
  const d = (a, b) => Math.hypot((lm[a].x - lm[b].x) * W, (lm[a].y - lm[b].y) * H);
  return Math.max(d(0, 9), d(5, 17));
}

export class ThrowCam {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = $('#throwcam'); this.video = $('#tc-video'); this.meter = $('#tc-meter i');
    $('#tc-close').onclick = () => { const cb = this.onCancel; this.close(); cb?.(); };
    this.isOpen = false; this.stream = null; this.raf = 0; this.session = 0;
  }

  /** Show the camera panel and watch for a throw. onThrow() fires once; onError(err) if the camera or tracker
   *  can't start (the panel closes itself); onCancel() if the player closes it; onCharge(f) as the throw builds
   *  (0 = no push yet … 1 = the throw). */
  async open({ onThrow, onError, onCancel, onCharge }) {
    if (this.isOpen) return;
    const session = ++this.session;
    this.isOpen = true; this.onThrow = onThrow; this.onCancel = onCancel; this.onCharge = onCharge;
    this.el.hidden = false; this.el.className = ''; this.setMeter(0);
    try {
      const [stream, hands] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        preloadHands(),
      ]);
      if (session !== this.session) { stream.getTracks().forEach((t) => t.stop()); return; }   // closed while starting
      this.stream = stream; this.hands = hands;
      this.video.srcObject = stream; await this.video.play();
      if (session !== this.session) return;
      this.reset();
      this.loop(session);
    } catch (err) {
      if (session !== this.session) return;
      console.warn('Snowball camera unavailable:', err);
      this.close(); onError?.(err);
    }
  }

  close() {
    this.session++; this.isOpen = false; cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null;   // camera light off
    this.video.srcObject = null; this.el.hidden = true;
    this.onThrow = this.onCancel = this.onCharge = null;
  }

  setMeter(f) { f = Math.min(1, Math.max(0, f)); this.meter.style.width = `${Math.round(f * 100)}%`; this.onCharge?.(f); }
  reset() { this.disarm(); this.lastTs = -1; this.done = false; }
  disarm() { this.hist = []; this.fistSince = -1; this.armed = false; this.lastSeen = -1; this.openSince = -1; }

  loop(session) {
    if (session !== this.session) return;
    this.raf = requestAnimationFrame(() => this.loop(session));
    const v = this.video;
    if (v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    let ts = performance.now(); if (ts <= this.lastTs) ts = this.lastTs + 1; this.lastTs = ts;   // must increase
    const res = this.hands.detectForVideo(v, ts);
    this.step(res, ts / 1000);
  }

  step(res, t) {
    if (this.done) return;
    const W = this.video.videoWidth, H = this.video.videoHeight;
    // the hand to follow: a fist if there is one, else the first hand
    const n = res.landmarks.length;
    let pick = -1;
    for (let i = 0; i < n; i++) if (isFist(res.worldLandmarks[i])) { pick = i; break; }
    const fist = pick >= 0; if (!fist && n) pick = 0;
    const open = !fist && n > 0 && isOpen(res.worldLandmarks[pick]);

    if (!n) {
      // hand gone mid-throw (it got too close or too fast to track): still a throw if it was clearly coming in
      if (this.armed && t - this.lastSeen < 0.2 && this.growth() >= LOST_THROW) return this.fire();
      if (this.lastSeen < 0 || t - this.lastSeen > LOST_GRACE) {
        this.disarm(); this.setMeter(0);
      }
      return;
    }
    this.lastSeen = t;

    if (!this.armed) {                       // waiting for the fist that holds the snowball
      if (!fist) { this.fistSince = -1; this.setMeter(0); return; }
      if (this.fistSince < 0) this.fistSince = t;
      if (t - this.fistSince < FIST_HOLD) return;
      this.armed = true; this.hist = [];
    }

    // armed: follow the hand in, whatever shape it's in on the way (it's opening as it comes)
    this.hist.push({ t, size: palmSize(res.landmarks[pick], W, H) });
    while (this.hist.length && t - this.hist[0].t > PUSH_WINDOW) this.hist.shift();
    const grow = this.growth(), k = Math.min(1, Math.max(0, (grow - 1) / (PUSH - 1)));
    if (open) {
      if (grow >= PUSH) return this.fire();
      if (this.openSince < 0) this.openSince = t;
      if (t - this.openSince > OPEN_EARLY) {   // let go too far away: start over with a fist
        this.disarm(); this.setMeter(0);
        return;
      }
    } else this.openSince = -1;
    this.setMeter(k * CHARGE_MAX);
  }

  /** How much the hand has grown: latest size over the smallest size in the window. */
  growth() {
    if (!this.hist.length) return 1;
    const min = Math.min(...this.hist.map((h) => h.size));
    return this.hist[this.hist.length - 1].size / min;
  }

  fire() {
    this.done = true; this.setMeter(1); this.el.className = 'thrown';
    const cb = this.onThrow; this.onThrow = null;
    setTimeout(() => this.close(), 350);
    cb?.();
  }

}
