// Snowball throw by webcam: the player makes a fist and punches it toward the camera.
// MediaPipe's HandLandmarker (runtime + model served from public/mediapipe/, so no CDN) tracks the hand each video
// frame. A hand counts as a fist when at least FIST_FINGERS of the four fingertips are curled in toward the wrist
// (measured on the 3D world landmarks, so it doesn't matter how far away the hand is). While the fist is held its
// on-screen size is tracked; growing by PUSH× within PUSH_WINDOW s (the fist coming at the lens) is the throw.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const PUSH = 1.35;            // how much bigger the fist must get on screen to count as a throw
const PUSH_WINDOW = 0.8;      // ...within this many seconds
const FIST_FINGERS = 3;       // curled fingertips (of index/middle/ring/pinky) needed for a fist
const FIST_HOLD = 0.12;       // the fist must be held this long (s) before a push counts
const LOST_GRACE = 0.25;      // a fist that drops out for less than this (s) keeps its history
const LOST_THROW = 1.2;       // if the hand vanishes mid-push (too close / too fast) at this growth, it still counts

const asset = (p) => new URL(p, document.baseURI).href;
const FINGERS = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];   // mcp, pip, tip landmark indices
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

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

export class ThrowCam {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = $('#throwcam'); this.video = $('#tc-video'); this.canvas = $('#tc-hands');
    this.msg = $('#tc-msg'); this.meter = $('#tc-meter i');
    this.g = this.canvas.getContext('2d');
    $('#tc-close').onclick = () => { const cb = this.onCancel; this.close(); cb?.(); };
    this.isOpen = false; this.stream = null; this.raf = 0; this.session = 0;
  }

  /** Show the camera panel and watch for a throw. onThrow() fires once; onError(err) if the camera or tracker
   *  can't start (the panel closes itself); onCancel() if the player closes it; onCharge(f) as the punch builds
   *  (0 = no push yet … 1 = the throw). */
  async open({ onThrow, onError, onCancel, onCharge }) {
    if (this.isOpen) return;
    const session = ++this.session;
    this.isOpen = true; this.onThrow = onThrow; this.onCancel = onCancel; this.onCharge = onCharge;
    this.el.hidden = false; this.el.className = ''; this.say('Starting camera…'); this.setMeter(0);
    this.g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    try {
      const [stream, hands] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
        preloadHands(),
      ]);
      if (session !== this.session) { stream.getTracks().forEach((t) => t.stop()); return; }   // closed while starting
      this.stream = stream; this.hands = hands;
      this.video.srcObject = stream; await this.video.play();
      if (session !== this.session) return;
      this.canvas.width = this.video.videoWidth; this.canvas.height = this.video.videoHeight;
      this.reset(); this.say('Make a fist ✊');
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

  say(text) { this.msg.textContent = text; }
  setMeter(f) { f = Math.min(1, Math.max(0, f)); this.meter.style.width = `${Math.round(f * 100)}%`; this.onCharge?.(f); }
  reset() { this.hist = []; this.fistSince = -1; this.lastFist = -1; this.lastTs = -1; this.done = false; }

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
    const W = this.canvas.width, H = this.canvas.height, g = this.g;
    g.clearRect(0, 0, W, H);
    // the hand to follow: a fist if there is one, else the first hand
    let pick = -1;
    for (let i = 0; i < res.landmarks.length; i++) if (isFist(res.worldLandmarks[i])) { pick = i; break; }
    const fist = pick >= 0; if (!fist && res.landmarks.length) pick = 0;
    if (pick >= 0) this.draw(res.landmarks[pick], fist);

    if (!fist) {
      // hand gone mid-punch (it got too close or too fast to track): still a throw if it was clearly growing
      if (this.hist.length && t - this.lastFist < 0.2 && !res.landmarks.length && this.growth() >= LOST_THROW) return this.fire();
      if (this.lastFist < 0 || t - this.lastFist > LOST_GRACE) {
        this.hist = []; this.fistSince = -1; this.setMeter(0);
        this.say(res.landmarks.length ? 'Make a fist ✊' : 'Show your hand to the camera ✋');
      }
      return;
    }
    const lm = res.landmarks[pick];
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const p of lm) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const size = Math.hypot((x1 - x0) * W, (y1 - y0) * H);          // a fist is a ball: its box barely changes as it turns
    if (this.fistSince < 0) this.fistSince = t;
    this.lastFist = t;
    this.hist.push({ t, size });
    while (this.hist.length && t - this.hist[0].t > PUSH_WINDOW) this.hist.shift();
    const grow = this.growth();
    this.setMeter((grow - 1) / (PUSH - 1));
    this.say('Now punch toward the camera! 👊');
    if (t - this.fistSince >= FIST_HOLD && grow >= PUSH) this.fire();
  }

  /** How much the fist has grown: latest size over the smallest size in the window. */
  growth() {
    if (!this.hist.length) return 1;
    const min = Math.min(...this.hist.map((h) => h.size));
    return this.hist[this.hist.length - 1].size / min;
  }

  fire() {
    this.done = true; this.setMeter(1); this.say('❄ Snowball!'); this.el.className = 'thrown';
    const cb = this.onThrow; this.onThrow = null;
    setTimeout(() => this.close(), 350);
    cb?.();
  }

  draw(lm, fist) {
    const g = this.g, W = this.canvas.width, H = this.canvas.height;
    g.lineWidth = Math.max(2, W / 160); g.strokeStyle = g.fillStyle = fist ? '#8fd8ff' : 'rgba(255,255,255,.85)';
    g.beginPath();
    for (const [a, b] of BONES) { g.moveTo(lm[a].x * W, lm[a].y * H); g.lineTo(lm[b].x * W, lm[b].y * H); }
    g.stroke();
    for (const p of lm) { g.beginPath(); g.arc(p.x * W, p.y * H, g.lineWidth * 1.3, 0, Math.PI * 2); g.fill(); }
  }
}
