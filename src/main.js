import * as THREE from 'three';
import './style.css';
import { IMG_W, IMG_H, setupCamera, buildWalkArea, drawDebug } from './scene.js';
import { Crowd } from './crowd.js';
import { Profile, hud, showScreen } from './ui.js';
import * as sfx from './sfx.js';
import { loadMiiModels } from './mii.js';
import { createFreeze } from './games/freeze.js';
import { createSignal } from './signal.js';
import { installWiiCursor } from './cursor.js';

installWiiCursor();

// The shell: renderer, street scene, crowd, layout, pointer and the animation loop. The round itself lives in
// src/games/freeze.js as a mode: update(dt), hover(pointer), down(pointer), stop().
const params = new URLSearchParams(location.search), debug = params.has('debug');
const $ = (s) => document.querySelector(s);

// ---- renderer + scene ----
const stage = $('#stage'), canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = setupCamera();
const hemi = new THREE.HemisphereLight(0xfff6ec, 0x9a93b0, 1.7);
const sun = new THREE.DirectionalLight(0xffffff, 1.9); sun.position.set(-5, 10, 6);
for (const l of [hemi, sun]) { l.layers.enable(1); scene.add(l); }

await loadMiiModels();                    // Mii bodies, heads, hair and hats (public/models)
const area = buildWalkArea(camera);
if (debug) drawDebug(scene, area);
const crowd = new Crowd(scene, area);
const profile = new Profile(renderer, scene);

// ---- layout: the stage fills the window; the photo is scaled to cover it (cropping the overflow, centred) and
// the camera is given the same crop with setViewOffset, so the 3D people stay lined up with the photo.
// Look-around: the photo is drawn LOOK_OVERSCAN bigger than needed, and the crop drifts toward the cursor
// (photo and camera together, so they stay aligned), like a gentle head turn from the same spot. ----
const LOOK_OVERSCAN = 1.05;   // extra photo scale that gives the crop room to drift
const LOOK_EASE = 3;          // how quickly the view follows the cursor (1/s)
let stageW = 0, stageH = 0, photoScale = 1, cropX = 0, cropY = 0, fullW = 0, fullH = 0;
let lookOn = debug;           // held still during the intro zoom
const look = { x: 0, y: 0, tx: 0, ty: 0 };   // current and target, −1..1 across the stage
function layout() {
  stageW = innerWidth; stageH = innerHeight;
  photoScale = Math.max(stageW / IMG_W, stageH / IMG_H) * LOOK_OVERSCAN;
  fullW = IMG_W * photoScale; fullH = IMG_H * photoScale;
  Object.assign(stage.style, { width: stageW + 'px', height: stageH + 'px', left: '0px', top: '0px' });
  $('#photo').style.width = fullW + 'px'; $('#photo').style.height = fullH + 'px';
  applyCrop();
  renderer.setSize(stageW, stageH);
  stage.style.setProperty('--sw', Math.min(stageW, stageH * IMG_W / IMG_H) + 'px');   // the profile phone scales with the window
}
function applyCrop() {
  const mx = (fullW - stageW) / 2, my = (fullH - stageH) / 2;
  cropX = mx * (1 + look.x); cropY = my * (1 + look.y);
  $('#photo').style.left = -cropX + 'px'; $('#photo').style.top = -cropY + 'px';
  camera.setViewOffset(fullW, fullH, cropX, cropY, stageW, stageH);
}
function updateLook(dt) {
  if (!lookOn) { look.tx = look.ty = 0; }
  const k = 1 - Math.exp(-LOOK_EASE * dt);
  const dx = (look.tx - look.x) * k, dy = (look.ty - look.y) * k;
  if (Math.abs(dx) + Math.abs(dy) < 1e-5) return;
  look.x += dx; look.y += dy; applyCrop();
}
addEventListener('pointermove', (e) => {
  look.tx = Math.max(-1, Math.min(1, e.clientX / innerWidth * 2 - 1));
  look.ty = Math.max(-1, Math.min(1, e.clientY / innerHeight * 2 - 1));
});
document.documentElement.addEventListener('pointerleave', () => { look.tx = look.ty = 0; });
addEventListener('resize', layout); layout();

// ---- pointer ----
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pointer = null;            // {x, y} in stage px, or null when off the stage
function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  ndc.set(pointer.x / r.width * 2 - 1, 1 - pointer.y / r.height * 2);
  if (debug) { const d = $('#debug-info'); d.hidden = false; d.textContent = `img px ${Math.round((pointer.x + cropX) / photoScale)}, ${Math.round((pointer.y + cropY) / photoScale)}`; }
}
canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('pointerleave', () => { pointer = null; });
canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  if (debug) console.log('img px', $('#debug-info').textContent);
  mode?.down(pointer);
});

// ---- modes ----
let mode = null;
const ctx = {
  renderer, scene, camera, crowd, profile, raycaster, ndc, canvas, showScreen,
  size: () => ({ w: stageW, h: stageH }),
  setMode(m) { mode?.stop?.(); mode = m; if (!m) { canvas.className = ''; crowd.setHover(null); } },
};

// ---- start screen → round → over screen ----
// the crossing signal shows WALK during a round and turns back to the red hand when it ends
const signal = createSignal();
function startFreeze() {
  showScreen(null); signal.walk();
  const m = createFreeze(ctx, { onDone: (r) => { overScreen(r); } });
  ctx.setMode(m);
  if (debug) window.__game.freeze = m;
}
function overScreen(r) {
  hud.show(false); signal.stop({ blink: true });
  $('#over-title').textContent = r.won ? 'All CEOs frozen! ❄' : "Time's up!";
  const list = (as) => as.map((a) => a.name).join(', ');
  const stats = $('#over-stats'); stats.replaceChildren();
  const line = (html) => { const d = document.createElement('div'); d.innerHTML = html; stats.append(d); return d; };
  line(`You froze <b>${r.caught} of ${r.ceoCount}</b> CEOs` + (r.won ? ` with <b>${Math.ceil(r.timeLeft)} s</b> to spare` : '') + `. Wrong catches: ${r.wrong}`);
  if (r.frozen.length) line('').append(Object.assign(document.createElement('span'), { className: 'names', textContent: `❄ Frozen: ${list(r.frozen)}` }));
  if (r.escaped.length) line('').append(Object.assign(document.createElement('span'), { className: 'names', textContent: `🏃 Got away: ${list(r.escaped)}` }));
  showScreen('over-screen');
}

$('#start').onclick = startFreeze;
$('#restart').onclick = startFreeze;
// browsers only allow audio after a gesture: the first click or key anywhere starts it (and the WALK tick, if it's showing)
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => sfx.unlock(), { once: true, capture: true });
$('#sound').onclick = () => { $('#sound').textContent = sfx.toggleMute() ? '🔇' : '🔊'; };

// ?debug skips the start screen; window.__game is for tuning from the console
// Intro: the empty street at its normal view with the steady red hand; the photo zooms in on the crossing signal,
// the signal turns to WALK, the view zooms back out, then the start screen comes up. The crowd only floods in once
// Play is pressed (crowd.reset() in the round). ?debug skips all of it.
const INTRO = { wait: 0.8, zoomIn: 1.6, red: 0.9, walk: 1.2, zoomOut: 1.4, beat: 0.3 };   // seconds, in order
const INTRO_ZOOM = 3;                    // how far the photo zooms in on the signal
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
/** Zoom the photo so the walk sign is centred at `zoom`× (clamped so the photo still covers the stage). */
function signalZoom(zoom) {
  const photo = $('#photo'), pr = photo.getBoundingClientRect(), sr = $('#walk-sign').getBoundingClientRect();
  const lx = sr.left + sr.width / 2 - pr.left, ly = sr.top + sr.height / 2 - pr.top;   // sign centre, in photo px
  const left = -cropX, top = -cropY, fullW = pr.width, fullH = pr.height;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(stageW / 2 - left - zoom * lx, stageW - left - zoom * fullW, -left);
  const ty = clamp(stageH / 2 - top - zoom * ly, stageH - top - zoom * fullH, -top);
  return `translate(${tx}px, ${ty}px) scale(${zoom})`;
}
function zoomPhoto(from, to, secs) {
  const anim = $('#photo').animate([{ transform: from }, { transform: to }],
    { duration: secs * 1000, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });
  return anim.finished.then(() => anim);
}
async function intro() {
  // browsers block audio until a gesture; if it's blocked, wait for one click first so the WALK tick plays on cue
  if (!(await sfx.tryStart())) {
    showScreen('tap-screen');
    await new Promise((r) => { $('#tap').onclick = r; });
    sfx.unlock(); showScreen(null);
  }
  $('#photo').style.transformOrigin = '0 0';
  await sleep(INTRO.wait);
  const close = signalZoom(INTRO_ZOOM);
  await zoomPhoto('none', close, INTRO.zoomIn);
  await sleep(INTRO.red);
  signal.walk();
  await sleep(INTRO.walk);
  (await zoomPhoto(close, 'none', INTRO.zoomOut)).cancel();   // back to normal; drop the animation so layout() owns the photo again
  lookOn = true;
  await sleep(INTRO.beat);
  showScreen('start-screen');
}

if (debug) { window.__game = { crowd, camera, THREE, ctx, get mode() { return mode; } }; startFreeze(); }
else intro();

// ---- loop ----
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateLook(dt);
  if (!mode?.pauseCrowd) crowd.update(dt);   // the crowd keeps walking behind the menus too
  // background chatter follows how many people are on the street (not still walking in, not frozen; it fades as
  // they walk off at the end of a round)
  sfx.crowdLevel(crowd.total ? crowd.agents.filter((a) => !a.entering && !a.frozen).length / crowd.total : 0);
  mode?.update(dt);
  if (!mode?.render?.()) renderer.render(scene, camera);
  if (mode) mode.hover(pointer);
  else { canvas.className = ''; crowd.setHover(null); }
});
