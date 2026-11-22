// Wii-style pointer (after design-references/dragging-tail-cursor.png): a white pointing hand with a two-tone #E44023
// outline, dragging a soft translucent tail in the same colour behind it while it moves. It leans a little
// into the direction of travel (like the Wii Remote's roll), swells over anything clickable and squashes on press.
// The native cursor is hidden only on mouse-type (fine) pointers; touch screens keep no cursor at all.

const HAND_H = 46;                 // on-screen height of the hand, px
const VIEW_W = 50, VIEW_H = 62;    // SVG viewBox
const HOT = { x: 16, y: 1 };       // the index fingertip in viewBox units: the click point
const TAIL_LIFE = 0.2;             // s a tail point lasts
const TAIL_W = 30;                 // tail width at the hand, px (tapers to nothing at the end)
const TAIL_FROM = { x: 11, y: 24 };// where the tail leaves the hand, px from the fingertip (the back of the hand)
const TILT_MAX = 18, TILT_K = 0.012, TILT_EASE = 10;   // lean: degrees max, degrees per px/s, easing rate
const HOVER_SCALE = 1.12, PRESS_SCALE = 0.88;
const CLICKABLE = 'button, a, [role="button"], .ph-scroll, #gl.on-person, #pf-freeze';

// the glove: every shape is drawn three times (thick #E44023 stroke, thinner light tint, white fill)
// so the outlines merge into one clean two-tone edge around the whole hand
const SHAPES = `
  <rect x="11" y="3" width="10" height="34" rx="5"/>
  <rect x="20" y="18.5" width="9.5" height="19" rx="4.75"/>
  <rect x="28.5" y="21" width="8.5" height="16" rx="4.25"/>
  <rect x="35.5" y="24" width="7.5" height="13.5" rx="3.75"/>
  <rect x="10" y="28" width="33" height="27" rx="9"/>
  <ellipse cx="9.5" cy="37" rx="4.6" ry="8" transform="rotate(-32 9.5 37)"/>`;
const HAND_SVG = `
<svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${HAND_H * VIEW_W / VIEW_H}" height="${HAND_H}" aria-hidden="true">
  <defs><linearGradient id="wii-glove" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#fff8f6"/><stop offset="1" stop-color="#fbe3dd"/>
  </linearGradient></defs>
  <g fill="#E44023" stroke="#E44023" stroke-width="7" stroke-linejoin="round">${SHAPES}</g>
  <g fill="#f6a08c" stroke="#f6a08c" stroke-width="3.2" stroke-linejoin="round">${SHAPES}</g>
  <g fill="url(#wii-glove)">${SHAPES}</g>
  <g fill="none" stroke="#e6c3bb" stroke-width="1.3" stroke-linecap="round">
    <path d="M20.6 31v5"/><path d="M29 32v4.5"/><path d="M36 33v3.5"/>
  </g>
</svg>`;

export function installWiiCursor() {
  if (!matchMedia('(pointer: fine)').matches) return;
  document.documentElement.classList.add('wii-cursor');

  const tail = document.createElement('canvas');
  tail.id = 'wii-tail';
  const hand = document.createElement('div');
  hand.id = 'wii-hand';
  hand.innerHTML = HAND_SVG;
  const s = HAND_H / VIEW_H, hotX = HOT.x * s, hotY = HOT.y * s;
  hand.style.transformOrigin = `${hotX}px ${hotY}px`;
  document.body.append(tail, hand);
  const g = tail.getContext('2d');

  let dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    tail.width = innerWidth * dpr; tail.height = innerHeight * dpr;
  }
  addEventListener('resize', resize); resize();

  let x = -100, y = -100, shown = false, hover = false, down = false;
  let tilt = 0, scale = 1, vx = 0, lastX = null, lastT = 0;
  const pts = [];                 // recent positions {x, y, t}
  const show = (on) => { shown = on; hand.style.opacity = on ? 1 : 0; if (!on) pts.length = 0; };
  show(false);

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') { show(false); return; }
    x = e.clientX; y = e.clientY;
    hover = !!e.target.closest?.(CLICKABLE);
    if (!shown) { show(true); lastX = null; }
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') down = true; }, { passive: true });
  addEventListener('pointerup', () => { down = false; }, { passive: true });
  addEventListener('blur', () => { down = false; });
  document.documentElement.addEventListener('pointerleave', () => show(false));

  function frame(now) {
    requestAnimationFrame(frame);
    const t = now / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016);
    lastT = t;

    // lean into the motion
    if (lastX !== null && dt > 0) vx += ((x - lastX) / dt - vx) * Math.min(1, dt * 12);
    lastX = x;
    const want = Math.max(-TILT_MAX, Math.min(TILT_MAX, vx * TILT_K));
    tilt += (want - tilt) * (1 - Math.exp(-TILT_EASE * dt));
    const sWant = down ? PRESS_SCALE : hover ? HOVER_SCALE : 1;
    scale += (sWant - scale) * (1 - Math.exp(-18 * dt));
    hand.style.transform = `translate(${x - hotX}px, ${y - hotY}px) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

    // the tail: a tapering ribbon through recent positions, leaving from the back of the hand
    if (shown) {
      const last = pts[pts.length - 1];
      if (!last || last.x !== x || last.y !== y) pts.push({ x, y, t });
    }
    while (pts.length && t - pts[0].t > TAIL_LIFE) pts.shift();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, innerWidth, innerHeight);
    if (pts.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = 1 - (t - b.t) / TAIL_LIFE;   // 1 at the hand → 0 at the end
      if (k <= 0) continue;
      g.lineWidth = TAIL_W * (0.25 + 0.75 * k) * scale;
      g.strokeStyle = `rgb(${245 - 17 * k}, ${150 - 86 * k}, ${130 - 95 * k})`;
      g.beginPath();
      g.moveTo(a.x + TAIL_FROM.x, a.y + TAIL_FROM.y);
      g.lineTo(b.x + TAIL_FROM.x, b.y + TAIL_FROM.y);
      g.stroke();
    }
  }
  requestAnimationFrame(frame);
}
