import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const $ = id => document.getElementById(id);
const v = $('v'), c = $('c'), g = c.getContext('2d');
let W, H, sceneDirty = true; const resize = () => { W = c.width = innerWidth; H = c.height = innerHeight; sceneDirty = true; }; resize(); onresize = resize;
const R = (a, b) => a + Math.random() * (b - a);

// ---------- gestures ----------
const G = {
  open:  { e: '✋', name: 'Snowfall',   tip: 'Open your palm to make it snow' },
  point: { e: '☝️', name: 'Frost Draw', tip: 'Point one finger & draw sparkly frost' },
  fist:  { e: '✊', name: 'Snowball', tip: 'Make a fist to pack a snowball ⚪ (slam it down for ice spikes!)' },
  throw: { e: '🫳', name: 'Throw!', tip: 'Push your fist toward the camera & open your hand to THROW it at the screen!' },
  pinch: { e: '🤏', name: 'Snowflake',  tip: 'Pinch thumb + index for a snowflake' },
  peace: { e: '✌️', name: 'Ice Tower',  tip: 'Peace sign builds a crystal tower' },
  three: { e: '🤟', name: 'Aurora',     tip: 'Hold up 3 fingers to paint an aurora', alt: '3 fingers' },
  thumb: { e: '👍', name: 'Snow Buddy', tip: 'Thumbs up to build a little snow buddy' },
  rock:  { e: '🤘', name: 'Thaw / Clear', tip: 'Rock on 🤘 to melt everything away' },
};
const order = ['open', 'point', 'fist', 'throw', 'pinch', 'peace', 'three', 'thumb', 'rock'];
function showActive(k) {
  const el = $('legend');
  if (!k) { el.style.opacity = .5; el.innerHTML = '<span class="hint">show me some magic ✋ ☝️ ✊ 🤏 ✌️ 🤟 👍 🤘</span>'; return; }
  el.style.opacity = 1; el.innerHTML = `<b>${G[k].e}</b><span>${G[k].name}</span>`;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function gesture(lm) {
  const w = lm[0], size = dist(lm[0], lm[9]);
  const up = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([t, p]) => dist(lm[t], w) > dist(lm[p], w) * 1.1);
  const n = up.filter(Boolean).length;
  const thumbOut = dist(lm[4], lm[5]) > size * 0.7;
  if (dist(lm[4], lm[8]) < size * 0.25 && !up[1]) return 'pinch';
  if (n === 0 && thumbOut && lm[4].y < lm[3].y && lm[4].y < lm[5].y - size * .3) return 'thumb';
  if (n === 4) return 'open';
  if (n === 0) return 'fist';
  if (up[0] && !up[1] && !up[2] && up[3]) return 'rock';
  if (up[0] && up[1] && up[2] && !up[3]) return 'three';
  if (up[0] && up[1] && !up[2] && !up[3]) return 'peace';
  if (up[0] && !up[1] && !up[2] && !up[3]) return 'point';
  return null;
}
const px = p => ({ x: (1 - p.x) * W, y: p.y * H });

// ---------- world ----------
const flakes = [], frost = [], spikes = [], crystals = [], towers = [], auroras = [], buddies = [], sparks = [], balls = [], splats = [];
const held = {}; const vel = {}; let thrown = false;
let wind = 0, melt = 0, rockHold = 0, blizzard = 0;
const last = {}; const prevTip = {}; const prevPalm = {};
const every = (k, ms, now) => (now - (last[k] || 0) > ms) && (last[k] = now);

function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1100); }
function burst(x, y, n = 20, col) { for (let i = 0; i < n; i++) { const a = R(0, 6.3), s = R(1, 5); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, col: col || `hsl(${R(200, 280)},90%,90%)` }); } }

function act(gs, lm, now, hi) {
  const palm = px(lm[9]), tip = px(lm[8]);
  // palm swipe -> wind
  if (prevPalm[hi]) {
    wind += (palm.x - prevPalm[hi].x) * 0.01;
    const pv = vel[hi] || { x: 0, y: 0 };
    vel[hi] = { x: pv.x * .5 + (palm.x - prevPalm[hi].x) * .5, y: pv.y * .5 + (palm.y - prevPalm[hi].y) * .5 };
  }
  prevPalm[hi] = palm;
  // snowball: pack with a fist, release (open hand) to throw
  if (gs === 'fist') held[hi] = Math.min(34, (held[hi] || 6) + .5);
  else if (held[hi] > 10) {
    const vv = vel[hi] || { x: 0, y: 0 };
    balls.push({ x: palm.x, y: palm.y, vx: vv.x, vy: vv.y, r: held[hi], spin: 0, z: 1 });
    held[hi] = 0; thrown = true;
  } else held[hi] = 0;
  if (gs !== 'point') prevTip[hi] = null;

  // fingertip pops snowflakes & pokes buddies
  for (let i = crystals.length - 1; i >= 0; i--) if (dist(crystals[i], tip) < crystals[i].s * .6 && crystals[i].s > crystals[i].max * .9 && gs === 'point') { burst(crystals[i].x, crystals[i].y, 30); crystals.splice(i, 1); }
  for (const b of buddies) if (Math.abs(tip.x - b.x) < 40 && Math.abs(tip.y - (H - 110)) < 90) { b.wiggle = 1; }

  if (gs === 'open') for (let i = 0; i < 4; i++) flakes.push({ x: palm.x + R(-110, 110), y: palm.y + R(-40, 40), vx: R(-.5, .5), vy: R(1, 3), r: R(1.5, 4), h: 260 });
  if (gs === 'point') {
    if (prevTip[hi]) frost.push({ a: prevTip[hi], b: tip, life: 1, h: 215 + Math.sin(now / 800) * 45 });
    sparks.push({ x: tip.x, y: tip.y, vx: R(-1, 1), vy: R(-1, 1), life: 1, col: '#fff' });
    prevTip[hi] = tip;
  }
  if (gs === 'fist' && (vel[hi]?.y || 0) > 22 && every('spike' + hi, 250, now)) for (let k = 0; k < 4; k++) spikes.push({ x: palm.x + R(-40, 40), w: R(20, 50), h: 0, max: R(120, 330), h2: R(215, 275) });
  if (gs === 'pinch' && every('cry' + hi, 450, now)) { crystals.push({ x: tip.x, y: tip.y, s: 0, max: R(30, 70), rot: R(0, 6), h: R(195, 275) }); burst(tip.x, tip.y, 12); }
  if (gs === 'peace' && every('tow' + hi, 900, now)) { towers.push({ x: palm.x, h: 0, max: R(220, 420), w: R(50, 80), h2: R(245, 295) }); }
  if (gs === 'three' && every('aur' + hi, 60, now)) auroras.push({ x: palm.x, y: palm.y, life: 1, h: Math.random() < .5 ? R(170, 195) : R(285, 325) });
  if (gs === 'thumb' && every('bud' + hi, 1500, now)) { buddies.push({ x: palm.x, s: 0, wiggle: 0 }); burst(palm.x, H - 120, 25); }
}

// ---------- drawing ----------
function snowflake(x, y, s, rot, h) {
  g.save(); g.translate(x, y); g.rotate(rot); g.strokeStyle = `hsl(${h},100%,92%)`; g.lineWidth = 2.5; g.lineCap = 'round'; g.shadowColor = `hsl(${h},90%,70%)`; g.shadowBlur = 16;
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s);
    for (const k of [.4, .7]) { g.moveTo(0, -s * k); g.lineTo(s * .22, -s * k - s * .2); g.moveTo(0, -s * k); g.lineTo(-s * .22, -s * k - s * .2); }
    g.stroke();
  }
  g.restore();
}
function buddy(b) {
  b.s += (1 - b.s) * .1; b.wiggle *= .92;
  const t = performance.now() / 120, sw = Math.sin(t) * b.wiggle * .3;
  g.save(); g.translate(b.x, H - 10); g.rotate(sw); g.scale(b.s, b.s);
  // soft slushy puddle at the base
  g.fillStyle = 'rgba(244,238,255,.95)'; g.beginPath(); g.ellipse(0, -2, 64, 13, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(150,125,210,.25)'; g.beginPath(); g.ellipse(6, 2, 58, 8, 0, 0, Math.PI); g.fill();
  const ball = (y, r) => {
    const gr = g.createRadialGradient(-r * .35, y - r * .4, r * .1, 0, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.6, '#f4efff'); gr.addColorStop(1, '#cbbbef');
    g.fillStyle = gr; g.beginPath(); g.arc(0, y, r, 0, 7); g.fill();
  };
  g.shadowColor = 'rgba(201,181,255,.9)'; g.shadowBlur = 20; ball(-40, 42); ball(-110, 32); g.shadowBlur = 0;
  const coal = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  g.fillStyle = '#2a2233';
  coal(-12, -118, 5); coal(12, -118, 5);                                  // eyes
  for (let i = 0; i < 7; i++) { const a = Math.PI * (.12 + i * .76 / 6); coal(Math.cos(a) * 19, -113 + Math.sin(a) * 17, 2.8); } // coal smile
  coal(0, -58, 4); coal(0, -38, 4);                                       // buttons
  g.fillStyle = 'rgba(245,170,200,.45)'; coal(-21, -106, 5); coal(21, -106, 5); // rosy cheeks
  g.fillStyle = '#e4502e'; g.beginPath(); g.moveTo(-6, -110); g.lineTo(6, -110); g.lineTo(0, -99); g.closePath(); g.fill(); // carrot nose
  g.restore();
}

// ---------- scenery: lavender dusk, moon, frosted trees, cobbled path, glowing igloo ----------
// Static layers are pre-rendered (seeded, so they look the same after a resize); only stars & drifting snow animate.
const HZ = .6;                       // horizon line (fraction of height)
let SKY, SCENE, FORE;
const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() * .32, r: R(.8, 2), p: R(0, 6) }));
const drift = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: R(1, 2.6), s: R(.0006, .0016), p: R(0, 6) }));
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function layer() { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return [cv, cv.getContext('2d')]; }
function cloud(c, x, y, w, h, rgb, a) {
  c.save(); c.translate(x, y); c.scale(w / h, 1);
  const gr = c.createRadialGradient(0, 0, 0, 0, 0, h); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  c.fillStyle = gr; c.beginPath(); c.arc(0, 0, h, 0, 7); c.fill(); c.restore();
}
function frostTree(c, x, base, h, rnd) {
  const tw = h * .06;
  c.fillStyle = '#3b2c4d'; c.strokeStyle = '#3b2c4d'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - tw * 1.5, base); c.quadraticCurveTo(x - tw * .4, base - h * .3, x - tw * .6, base - h * .6);
  c.lineTo(x + tw * .6, base - h * .6); c.quadraticCurveTo(x + tw * .4, base - h * .3, x + tw * 1.5, base); c.fill();
  c.lineWidth = tw * .55;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x, base - h * .5); c.quadraticCurveTo(x + d * h * .1, base - h * .6, x + d * h * .22, base - h * .7); c.stroke(); }
  // crown: overlapping clusters of frosty needles, shadow -> mid -> highlight
  const cy = base - h * .72, rx = h * .36, ry = h * .28;
  const blobs = [[0, .05, 1], [-.6, .2, .7], [.6, .18, .72], [-.28, -.42, .72], [.32, -.38, .7], [0, .45, .55]];
  c.lineWidth = Math.max(.8, h * .006);
  for (const [bx, by, bs] of blobs) {                            // solid frosty mass under the needles
    const ox = x + bx * rx, oy = cy + by * ry, r = rx * .62 * bs;
    const gr = c.createRadialGradient(ox - r * .3, oy - r * .4, r * .1, ox, oy, r);
    gr.addColorStop(0, '#d9ccf6'); gr.addColorStop(1, '#8670c0');
    c.fillStyle = gr; c.beginPath(); c.ellipse(ox, oy + r * .05, r * .92, r * .74, 0, 0, 7); c.fill();
  }
  [['#6f5aa8', .15], ['#b9a5ea', 0], ['#f3ecff', -.2]].forEach(([stroke, shift], pass) => {
    for (const [bx, by, bs] of blobs) {
      const ox = x + bx * rx, oy = cy + by * ry, r = rx * .62 * bs;
      c.strokeStyle = stroke;
      const n = Math.round(Math.min(220, Math.max(30, h * .5)) * bs * (pass === 2 ? .7 : 1));
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r;
        const sx = ox + Math.cos(a) * d, sy = oy + Math.sin(a) * d * .8 + r * shift;
        const L = r * (.1 + rnd() * .22), ang = a + (rnd() - .5) * .9 - (pass === 2 ? .5 : 0);
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(ang) * L, sy + Math.sin(ang) * L * .75); c.stroke();
      }
    }
  });
}
function igloo(c, x, base, r) {
  // warm glow spilling onto the snow
  let gr = c.createRadialGradient(x - r * .25, base, 0, x - r * .25, base, r * 1.8);
  gr.addColorStop(0, 'rgba(255,214,160,.55)'); gr.addColorStop(1, 'rgba(255,214,160,0)');
  c.fillStyle = gr; c.fillRect(x - r * 2.2, base - r * 2, r * 4.4, r * 3);
  c.save();
  c.beginPath(); c.ellipse(x, base, r, r * .88, 0, Math.PI, 0); c.closePath();
  gr = c.createRadialGradient(x - r * .35, base - r * .65, r * .1, x, base - r * .3, r * 1.15);
  gr.addColorStop(0, '#fbf7ff'); gr.addColorStop(.6, '#ddd0f7'); gr.addColorStop(1, '#a893de');
  c.fillStyle = gr; c.fill(); c.clip();
  // ice-block seams with warm light leaking through
  c.strokeStyle = 'rgba(255,205,170,.75)'; c.lineWidth = r * .03; c.lineCap = 'round';
  const rows = 6;
  for (let i = 1; i < rows; i++) {
    const y = base - i / rows * r * .88, hw = r * Math.sqrt(1 - Math.pow(i / rows, 2));
    c.beginPath(); c.moveTo(x - hw, y); c.quadraticCurveTo(x, y - r * .05, x + hw, y); c.stroke();
    const n = Math.max(2, Math.round(7 * hw / r)), off = i % 2 ? .5 : 0;
    for (let k = 0; k < n; k++) { const bx = x - hw + (k + off) / n * hw * 2, yy = base - (i - 1) / rows * r * .88; c.beginPath(); c.moveTo(bx, yy); c.lineTo(bx, y); c.stroke(); }
  }
  c.restore();
  // entrance tunnel
  const ex = x - r * .22, er = r * .4;
  c.fillStyle = '#e9e0fb'; c.beginPath(); c.ellipse(ex, base, er * 1.25, er * 1.25, 0, Math.PI, 0); c.fill();
  gr = c.createRadialGradient(ex, base - er * .2, 0, ex, base, er * 1.1);
  gr.addColorStop(0, '#fff4d6'); gr.addColorStop(.6, '#ffd59a'); gr.addColorStop(1, '#e9a873');
  c.fillStyle = gr; c.beginPath(); c.ellipse(ex, base, er, er * 1.05, 0, Math.PI, 0); c.fill();
  // snow skirt
  c.fillStyle = '#f2ecff'; c.beginPath(); c.ellipse(x, base, r * 1.25, r * .12, 0, 0, 7); c.fill();
}
function buildScenery() {
  const hy = H * HZ, vx = W * .5, m = Math.min(W, H);
  // --- sky: indigo -> violet -> dusky rose, moon, streaky clouds
  let s; [SKY, s] = layer();
  let gr = s.createLinearGradient(0, 0, 0, hy);
  gr.addColorStop(0, '#2c2060'); gr.addColorStop(.45, '#57408f'); gr.addColorStop(.8, '#a47cb8'); gr.addColorStop(1, '#e9a9b9');
  s.fillStyle = gr; s.fillRect(0, 0, W, H);
  const mx = W * .44, my = H * .13, mr = m * .045;
  gr = s.createRadialGradient(mx, my, mr, mx, my, mr * 6); gr.addColorStop(0, 'rgba(240,225,255,.45)'); gr.addColorStop(1, 'rgba(240,225,255,0)');
  s.fillStyle = gr; s.fillRect(0, 0, W, H);
  gr = s.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr); gr.addColorStop(0, '#fdfbff'); gr.addColorStop(1, '#dcd2ea');
  s.fillStyle = gr; s.beginPath(); s.arc(mx, my, mr, 0, 7); s.fill();
  s.fillStyle = 'rgba(150,135,185,.22)';
  for (const [dx, dy, rr] of [[-.3, -.2, .22], [.25, .15, .3], [-.1, .4, .15], [.4, -.35, .12]]) { s.beginPath(); s.arc(mx + dx * mr, my + dy * mr, rr * mr, 0, 7); s.fill(); }
  let r = rng(7);
  for (let i = 0; i < 16; i++) {
    const y = H * (.04 + r() * .5), t = y / hy;
    cloud(s, W * r(), y, W * (.14 + r() * .26), H * (.02 + r() * .035), t < .55 ? '58,36,104' : '214,140,182', t < .55 ? .3 + r() * .25 : .22 + r() * .2);
  }
  // --- scene (transparent above hills)
  let c; [SCENE, c] = layer(); r = rng(3);
  const wave = (x, base, a, b) => base - Math.sin(x / W * a + 1) * H * b - Math.sin(x / W * 13 + a) * H * .006;
  // far hills + far frosted treeline
  c.fillStyle = '#9d88d2'; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) c.lineTo(x, wave(x, hy - H * .045, 5, .022)); c.lineTo(W, H); c.fill();
  for (let i = 0; i < 26; i++) { const x = W * r(); if (Math.abs(x - vx) < W * .06) continue; frostTree(c, x, wave(x, hy - H * .04, 5, .022) + H * .01, H * (.05 + r() * .05), r); }
  c.fillStyle = '#c2b0e6'; c.beginPath(); c.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) c.lineTo(x, wave(x, hy - H * .01, 3.2, .015)); c.lineTo(W, H); c.fill();
  // near snowfield
  gr = c.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, '#cdbdea'); gr.addColorStop(1, '#f1ebfc');
  c.fillStyle = gr; c.fillRect(0, hy + H * .005, W, H);
  // dappled, cobbled-looking snow texture
  for (let y = hy + 2; y < H + 20;) {
    const p = (y - hy) / (H - hy), cr = 1.5 + p * 24;
    for (let x = -cr + r() * cr; x < W + cr; x += cr * 2.2) {
      c.fillStyle = r() < .55 ? 'rgba(255,255,255,.16)' : 'rgba(130,105,195,.07)';
      c.beginPath(); c.ellipse(x, y, cr, cr * .42, 0, 0, 7); c.fill();
    }
    y += cr * .85;
  }
  // soft shadowed drifts left & right
  for (const d of [-1, 1]) {
    gr = c.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, 'rgba(110,85,185,.0)'); gr.addColorStop(1, 'rgba(110,85,185,.22)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(vx + d * W * .03, hy); c.quadraticCurveTo(vx + d * W * .25, hy + H * .12, vx + d * W * .38, H); c.lineTo(vx + d * W * .48, H); c.quadraticCurveTo(vx + d * W * .3, hy + H * .1, vx + d * W * .05, hy); c.fill();
  }
  // cobblestone path in perspective
  const pw = p => W * (.012 + .27 * p);
  for (const d of [-1, 1]) {                                     // banked snow edges + inner shadow
    c.fillStyle = '#f5f0ff'; c.beginPath(); c.moveTo(vx + d * pw(0), hy); c.lineTo(vx + d * (pw(0) * 1.4), hy); c.lineTo(vx + d * (pw(1) * 1.2 + W * .03), H); c.lineTo(vx + d * pw(1), H); c.fill();
  }
  c.fillStyle = '#9b89c6'; c.beginPath(); c.moveTo(vx - pw(0), hy); c.lineTo(vx + pw(0), hy); c.lineTo(vx + pw(1), H); c.lineTo(vx - pw(1), H); c.fill();
  for (const d of [-1, 1]) { c.fillStyle = 'rgba(85,65,150,.35)'; c.beginPath(); c.moveTo(vx + d * pw(0), hy); c.lineTo(vx + d * pw(0) * .8, hy); c.lineTo(vx + d * pw(1) * .86, H); c.lineTo(vx + d * pw(1), H); c.fill(); }
  let row = 0;
  for (let y = H + 10; y > hy + 1; row++) {
    const p = (y - hy) / (H - hy), sh = Math.max(1, p * H * .055), hw = pw(p) * .82, n = 5, sw = hw * 2 / n, off = row % 2 ? sw * .5 : 0;
    for (let i = -1; i < n; i++) {
      if (r() < .12) continue;
      const x0 = Math.max(vx - hw, vx - hw + i * sw + off + sw * .07 + (r() - .5) * sw * .12), x1 = Math.min(vx + hw, vx - hw + (i + 1) * sw + off - sw * .07);
      const w = x1 - x0, hh = sh * (.72 + r() * .2), rad = Math.max(0, Math.min(w, hh) * .38);
      if (w < 1) continue;
      c.fillStyle = '#76649f'; c.beginPath(); c.roundRect(x0, y - hh + sh * .14, w, hh, rad); c.fill();
      c.fillStyle = `hsl(${258 + r() * 12},${26 + r() * 12}%,${76 + r() * 9}%)`; c.beginPath(); c.roundRect(x0, y - hh, w, hh, rad); c.fill();
      if (r() < .5) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x0 + w * .4, y - hh * .7, w * .25, hh * .12, 0, 0, 7); c.fill(); }
    }
    y -= sh * 1.22;
  }
  // frosted trees lining the path (far -> near)
  for (const p of [.03, .06, .1, .15, .22, .31, .43, .58]) for (const d of [-1, 1]) {
    const pp = p + (r() - .5) * .02, y = hy + pp * (H - hy);
    frostTree(c, vx + d * (pw(pp) * 1.5 + W * (.02 + pp * .12) + r() * W * .02), y, H * (.07 + pp * .75), r);
  }
  // dry grass tufts poking through the snow
  c.strokeStyle = 'rgba(80,60,110,.55)'; c.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const p = .15 + r() * .85, y = hy + p * (H - hy), d = r() < .5 ? -1 : 1, x = vx + d * (pw(p) * (1.25 + r() * 1.4)), L = p * H * .045;
    c.lineWidth = Math.max(.7, p * 2);
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (r() - .5) * 1.1; c.beginPath(); c.moveTo(x + (r() - .5) * L * .4, y); c.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); c.stroke(); }
  }
  // --- foreground: big frosted tree at the right edge, snowbank + glowing igloo bottom-left
  let f; [FORE, f] = layer(); r = rng(11);
  frostTree(f, W + m * .05, H * 1.04, H * .95, r);
  gr = f.createLinearGradient(0, H * .9, 0, H); gr.addColorStop(0, '#f7f3ff'); gr.addColorStop(1, '#d6c8f2');
  f.fillStyle = gr; f.beginPath(); f.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) { const k = Math.max(0, 1 - x / (W * .45)); f.lineTo(x, H - H * (.02 + .07 * k * k) - Math.sin(x / 70) * 3 * k); }
  f.lineTo(W, H); f.fill();
  igloo(f, m * .19, H - H * .035, m * .15);
}
function drawBackdrop(now) {
  if (sceneDirty) { buildScenery(); sceneDirty = false; }
  g.drawImage(SKY, 0, 0);
  for (const s of stars) { g.globalAlpha = .2 + .6 * Math.abs(Math.sin(now / 900 + s.p)); g.fillStyle = '#fff3ea'; g.beginPath(); g.arc(s.x * W, s.y * H, s.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  g.drawImage(SCENE, 0, 0);
}
function drawForeground(now) {
  g.fillStyle = 'rgba(255,255,255,.85)';                          // gentle ambient snowfall
  for (const d of drift) {
    d.y += d.s; if (d.y > 1.02) { d.y = -.02; d.x = Math.random(); }
    g.beginPath(); g.arc((d.x + Math.sin(now / 1500 + d.p) * .01) * W, d.y * H, d.r, 0, 7); g.fill();
  }
  g.drawImage(FORE, 0, 0);
}

// ---------- sprites (pre-rendered once) ----------
function lumpyPath(c, cx, cy, r, bumps, amt, seed) {
  c.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = i / 120 * Math.PI * 2;
    const k = 1 + amt * (Math.sin(a * bumps + seed) * .6 + Math.sin(a * (bumps * 2 + 1) + seed * 2) * .3 + Math.sin(a * 3 + seed * 3) * .4);
    const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
function speckle(c, cx, cy, r, n, col, min, max) { c.fillStyle = col; for (let i = 0; i < n; i++) { const a = R(0, 6.3), d = Math.sqrt(Math.random()) * r; c.beginPath(); c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R(min, max), 0, 7); c.fill(); } }
const BALL = (() => {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), m = S / 2, r = S * .42;
  lumpyPath(c, m, m, r, 7, .035, 1.3); c.save(); c.clip();
  let gr = c.createRadialGradient(m - r * .35, m - r * .4, r * .05, m, m, r * 1.05);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#f3f7ff'); gr.addColorStop(.8, '#ddd3f7'); gr.addColorStop(1, '#a996e0');
  c.fillStyle = gr; c.fillRect(0, 0, S, S);
  speckle(c, m + r * .2, m + r * .25, r * .8, 220, 'rgba(140,115,210,.18)', 1, 4);   // packed-snow texture
  speckle(c, m - r * .2, m - r * .2, r * .7, 160, 'rgba(255,255,255,.8)', .8, 3);
  gr = c.createRadialGradient(m + r * .55, m + r * .6, 0, m + r * .55, m + r * .6, r * .9);   // core shadow
  gr.addColorStop(0, 'rgba(110,80,190,.35)'); gr.addColorStop(1, 'rgba(110,80,190,0)'); c.fillStyle = gr; c.fillRect(0, 0, S, S);
  c.beginPath(); c.arc(m + r * .2, m + r * 1.25, r * .9, Math.PI * 1.15, Math.PI * 1.85); c.lineWidth = 6; c.strokeStyle = 'rgba(255,200,225,.5)'; c.stroke(); // warm rim light
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(m - r * .38, m - r * .45, r * .22, r * .12, -.6, 0, 7); c.fill();
  for (let i = 0; i < 6; i++) { const x = m + R(-r, r) * .7, y = m + R(-r, r) * .7, z = R(2, 5); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y - z); c.lineTo(x + z * .3, y); c.lineTo(x, y + z); c.lineTo(x - z * .3, y); c.fill(); }
  lumpyPath(c, m, m, r, 7, .035, 1.3); c.lineWidth = 3; c.strokeStyle = 'rgba(130,105,210,.45)'; c.stroke();
  return cv;
})();
const SPLAT = (() => {
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), m = S / 2, r = S * .3;
  const shape = () => {
    lumpyPath(c, m, m, r, 9, .12, .7); c.fill();
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28 + R(-.2, .2), d = r * R(1.05, 1.45), cr = R(18, 55); c.beginPath(); c.arc(m + Math.cos(a) * d, m + Math.sin(a) * d * .9, cr, 0, 7); c.fill(); }
    for (let i = 0; i < 7; i++) { const x = m + R(-r * .8, r * .8), w = R(22, 46), L = R(r * .5, r * 1.3), y = m + r * .6; c.beginPath(); c.roundRect(x - w / 2, y, w, L, w / 2); c.fill(); c.beginPath(); c.arc(x, y + L, w * .65, 0, 7); c.fill(); }
  };
  c.shadowColor = 'rgba(60,35,120,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 10; c.fillStyle = '#e9f0ff'; shape();
  c.shadowColor = 'transparent'; c.globalCompositeOperation = 'source-atop';
  const gr = c.createRadialGradient(m - r * .3, m - r * .3, r * .1, m, m, r * 1.6);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(.6, '#f5f0ff'); gr.addColorStop(1, '#cfc0f2'); c.fillStyle = gr; c.fillRect(0, 0, S, S);
  speckle(c, m, m, r * 1.5, 900, 'rgba(140,115,210,.16)', 1.5, 7);
  speckle(c, m, m, r * 1.4, 600, 'rgba(255,255,255,.9)', 1, 5);
  for (let i = 0; i < 40; i++) { const a = R(0, 6.3), d = R(0, r * 1.1), x = m + Math.cos(a) * d, y = m + Math.sin(a) * d, cr = R(8, 30); c.fillStyle = 'rgba(165,145,230,.22)'; c.beginPath(); c.arc(x + cr * .2, y + cr * .25, cr, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x, y, cr * .85, 0, 7); c.fill(); }
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(m - r * .4, m - r * .45, r * .25, r * .1, -.5, 0, 7); c.fill();
  return cv;
})();
function snowball(x, y, r, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(BALL, -r * 1.19, -r * 1.19, r * 2.38, r * 2.38); g.restore(); }

let shake = 0;
function drawScreenSplats() {
  if (shake > 0) { c.style.transform = `translate(${R(-1, 1) * shake}px,${R(-1, 1) * shake}px)`; shake *= .85; if (shake < .5) { shake = 0; c.style.transform = ''; } }
  for (let i = splats.length - 1; i >= 0; i--) {
    const sp = splats[i]; sp.t++;
    if (sp.t > 55) { sp.vy += .35; sp.y += sp.vy; }                       // cling to the glass, then slide off
    const pop = sp.t < 8 ? 1 - Math.pow(1 - sp.t / 8, 3) : 1;
    const sx = sp.size * (pop * (1 + .12 * Math.max(0, 1 - sp.t / 12))), sy = sp.size * pop * (1 - .1 * Math.max(0, 1 - sp.t / 12)) * (1 + Math.min(sp.vy * .004, .25));
    if (sp.y - sy * .5 > H) { splats.splice(i, 1); continue; }
    if (sp.y > sp.y0) {                                                     // frosty streak left on the glass
      const gr = g.createLinearGradient(0, sp.y0 - sy * .3, 0, sp.y); gr.addColorStop(0, 'rgba(240,232,255,0)'); gr.addColorStop(1, 'rgba(240,232,255,.3)');
      g.fillStyle = gr; g.fillRect(sp.x - sx * .28, sp.y0 - sy * .3, sx * .56, sp.y - sp.y0 + sy * .3);
    }
    g.save(); g.translate(sp.x, sp.y); g.rotate(sp.rot); g.drawImage(SPLAT, -sx / 2, -sy / 2, sx, sy); g.restore();
    if (sp.t < 6) { g.fillStyle = `rgba(255,255,255,${.6 * (1 - sp.t / 6)})`; g.fillRect(0, 0, W, H); }  // impact flash
  }
}
function render(now) {
  drawBackdrop(now);
  if (v.readyState >= 2) {
    const s = Math.max(W / v.videoWidth, H / v.videoHeight), vw = v.videoWidth * s, vh = v.videoHeight * s;
    g.save(); g.globalAlpha = .64; g.translate(W, 0); g.scale(-1, 1); g.drawImage(v, (W - vw) / 2, (H - vh) / 2, vw, vh); g.restore();
    g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = '#a58ae6'; g.fillRect(0, 0, W, H); g.restore();
    const dusk = g.createLinearGradient(0, 0, 0, H);                 // indigo sky above, rosy-lilac snow light below
    dusk.addColorStop(0, 'rgba(60,40,120,.28)'); dusk.addColorStop(.55, 'rgba(230,160,190,.08)'); dusk.addColorStop(1, 'rgba(235,222,255,.2)');
    g.fillStyle = dusk; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    vg.addColorStop(0, 'rgba(60,35,120,0)'); vg.addColorStop(1, 'rgba(60,35,120,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  const fade = 1 - melt;
  g.save(); g.globalAlpha = fade; g.translate(0, melt * 120);

  // aurora
  g.globalCompositeOperation = 'lighter';
  for (let i = auroras.length - 1; i >= 0; i--) {
    const a = auroras[i]; a.life -= .004; if (a.life <= 0) { auroras.splice(i, 1); continue; }
    const gr = g.createLinearGradient(0, a.y - 140, 0, a.y + 60);
    gr.addColorStop(0, 'transparent'); gr.addColorStop(.6, `hsla(${a.h},90%,70%,${.12 * a.life})`); gr.addColorStop(1, 'transparent');
    g.fillStyle = gr; g.fillRect(a.x - 30 + Math.sin(now / 900 + a.y) * 15, a.y - 140, 60, 200);
  }
  g.globalCompositeOperation = 'source-over';


  for (const t of towers) {
    t.h += (t.max - t.h) * .06; const top = H - t.h;
    const gr = g.createLinearGradient(t.x - t.w / 2, 0, t.x + t.w / 2, 0);
    gr.addColorStop(0, `hsla(${t.h2},80%,80%,.6)`); gr.addColorStop(.5, 'rgba(255,255,255,.9)'); gr.addColorStop(1, `hsla(${t.h2},80%,75%,.6)`);
    g.fillStyle = gr; g.shadowColor = `hsl(${t.h2},90%,80%)`; g.shadowBlur = 25;
    g.beginPath(); g.roundRect(t.x - t.w / 2, top, t.w, t.h, 6); g.fill();
    g.beginPath(); g.moveTo(t.x - t.w / 2 - 10, top + 4); g.lineTo(t.x, top - t.w * 1.5); g.lineTo(t.x + t.w / 2 + 10, top + 4); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,240,200,.8)';
    for (let y = top + 30; y < H - 60; y += 60) { g.beginPath(); g.roundRect(t.x - 8, y, 16, 22, 8); g.fill(); }
  }
  for (const s of spikes) {
    s.h += (s.max - s.h) * .15;
    const gr = g.createLinearGradient(0, H - s.h, 0, H); gr.addColorStop(0, '#fff'); gr.addColorStop(1, `hsla(${s.h2},90%,80%,.8)`);
    g.fillStyle = gr; g.shadowColor = '#c9b5ff'; g.shadowBlur = 15;
    g.beginPath(); g.moveTo(s.x - s.w / 2, H); g.lineTo(s.x, H - s.h); g.lineTo(s.x + s.w / 2, H); g.closePath(); g.fill();
    g.shadowBlur = 0;
  }
  buddies.forEach(buddy);

  g.lineCap = 'round';
  for (const f of frost) {
    f.life = Math.max(.45, f.life - .002);
    g.strokeStyle = `hsla(${f.h},100%,90%,${f.life})`; g.lineWidth = 7; g.shadowColor = `hsl(${f.h},100%,75%)`; g.shadowBlur = 18;
    g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.b.x, f.b.y); g.stroke();
  }
  g.shadowBlur = 0;
  for (const k of crystals) { k.s += (k.max - k.s) * .1; k.rot += .006; snowflake(k.x, k.y + Math.sin(now / 600 + k.rot) * 4, k.s, k.rot, k.h); }

  // snow (+ blizzard + wind)
  wind *= .96;
  if (blizzard > 0) { blizzard--; for (let i = 0; i < 12; i++) flakes.push({ x: R(-50, W), y: -10, vx: R(2, 6), vy: R(2, 5), r: R(1, 3.5), h: 260 }); }
  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i]; f.x += f.vx + wind + Math.sin(f.y * .02) * .5; f.y += f.vy;
    if (f.y > H - 30) { flakes.splice(i, 1); continue; }
    g.fillStyle = `hsl(${f.h},100%,96%)`; g.beginPath(); g.arc(f.x, f.y, f.r, 0, 7); g.fill();
  }
  // snowballs fly TOWARD the camera, ballooning in size, then smack the screen
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i]; b.z -= .04; const k = 1 - Math.max(b.z, 0);
    b.x += b.vx * .3 + (W / 2 - b.x) * .06 * k; b.y += b.vy * .3 + (H / 2 - b.y) * .06 * k - (1 - k) * 2; b.spin += .12;
    const rr = b.r * (1 + Math.pow(k, 3) * 28);
    for (let j = crystals.length - 1; j >= 0; j--) if (dist(b, crystals[j]) < crystals[j].s + rr * .5) { burst(crystals[j].x, crystals[j].y, 30); crystals.splice(j, 1); }
    if (b.z <= 0) {
      splats.push({ x: b.x, y: b.y, y0: b.y, size: Math.max(W, H) * 2.3, t: 0, vy: 0, rot: R(-.3, .3) });
      shake = 18; balls.splice(i, 1); continue;
    }
    snowball(b.x, b.y, rr, b.spin);
  }
  g.globalAlpha = fade;
  // sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vx *= .94; s.vy *= .94; s.life -= .025;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    g.globalAlpha = s.life * fade; g.fillStyle = s.col; g.beginPath(); g.arc(s.x, s.y, 2.5 * s.life + .5, 0, 7); g.fill();
  }
  g.restore();
  drawForeground(now);

  if (flakes.length > 3000) flakes.splice(0, flakes.length - 3000);
  if (frost.length > 4000) frost.splice(0, 500);

  // melting
  if (melt > 0) { melt += .02; if (melt >= 1) { [flakes, frost, spikes, crystals, towers, auroras, buddies, balls, splats].forEach(a => a.length = 0); melt = 0; } }
}

function drawHand(lm, gs) {
  g.fillStyle = 'rgba(255,255,255,.8)'; g.shadowColor = '#d6c6ff'; g.shadowBlur = 10;
  for (const i of [4, 8, 12, 16, 20]) { const q = px(lm[i]); g.beginPath(); g.arc(q.x, q.y, 4, 0, 7); g.fill(); }
  g.shadowBlur = 0;
}

// ---------- tutorial ----------
let step = 0, hold = 0, tutorial = true;
function setStep() {
  const k = order[step];
  $('big').textContent = G[k].e;
  $('msg').innerHTML = `<b>${G[k].name}</b> — ${G[k].tip}`;
  $('fill').style.width = '0%';
  $('dots').textContent = order.map((_, i) => i < step ? '❄' : i === step ? '✦' : '·').join(' ');
}
function finishTutorial() {
  tutorial = false; burst(W / 2, H / 2, 80);
  $('ui').innerHTML = `<h1>You're an ice mage now ✨</h1><div id="big">🏔️</div><p>Build your own winter wonderland!<br><small>Tip: ✊ fist + fling = snowball · slam fist down = ice spikes · two open palms = blizzard · swipe = wind · poke snowflakes with ☝️ · tickle snow buddies</small></p><button id="go">Let it snow ❄</button>`;
  $('go').onclick = startPlay;
}
function startPlay() { tutorial = false; $('ui').style.display = 'none'; $('legend').style.display = 'flex'; }

// ---------- main ----------
const files = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
const hands = await HandLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
  runningMode: "VIDEO", numHands: 2
});
v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
await v.play();
setStep();
$('ui').insertAdjacentHTML('beforeend', '<button class="ghost" id="skip">skip tutorial</button>');
$('skip').onclick = startPlay;
addEventListener('keydown', e => { if (e.key === 'c') melt = .01; });

function loop() {
  const now = performance.now();
  const res = hands.detectForVideo(v, now);
  const lms = res.landmarks || [];
  const seen = lms.map(gesture);
  lms.forEach((lm, i) => act(seen[i], lm, now, i));

  if (seen.length === 2 && seen[0] === 'open' && seen[1] === 'open' && every('bliz', 2500, now)) { blizzard = 90; toast('🌨️ BLIZZARD 🌨️'); }
  if (seen.includes('rock') && !tutorial) { if (++rockHold === 25 && melt === 0) { melt = .01; toast('💧 thaw…'); } } else rockHold = 0;

  render(now);
  lms.forEach((lm, i) => { if (held[i] > 6) { const q = px(lm[9]); snowball(q.x, q.y, held[i], 0); } drawHand(lm, seen[i]); });
  drawScreenSplats();
  if (!tutorial) showActive(seen.find(Boolean));

  if (tutorial && step < order.length) {
    if (order[step] === 'throw' && thrown) hold = 50;
    else if (seen.includes(order[step])) hold++; else hold = Math.max(0, hold - 1);
    $('fill').style.width = Math.min(100, hold / 50 * 100) + '%';
    if (hold >= 50) {
      hold = 0;
      if (order[step] === 'rock') melt = .01;
      burst(W / 2, 200, 40); step++;
      step < order.length ? setStep() : finishTutorial();
    }
  }
  thrown = false;
  requestAnimationFrame(loop);
}
loop();
