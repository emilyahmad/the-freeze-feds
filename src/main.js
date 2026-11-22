import * as THREE from 'three';
import './style.css';
import { IMG_W, IMG_H, setupCamera, buildWalkArea, drawDebug } from './scene.js';
import { Crowd } from './crowd.js';
import { HoverCard, Profile, hud, popup, snowBurst, wrongFlash, showScreen } from './ui.js';
import * as sfx from './sfx.js';
import { loadMiiModels } from './mii.js';

const ROUND_TIME = 60, BONUS = 10, PENALTY = 10;
const debug = new URLSearchParams(location.search).has('debug');
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
const card = new HoverCard(renderer, scene);
const profile = new Profile(renderer, scene);

// ---- layout: keep the stage at the photo's aspect ratio, letterboxed ----
let stageW = 0, stageH = 0;
function layout() {
  const aspect = IMG_W / IMG_H;
  stageW = innerWidth; stageH = innerWidth / aspect;
  if (stageH > innerHeight) { stageH = innerHeight; stageW = innerHeight * aspect; }
  Object.assign(stage.style, { width: stageW + 'px', height: stageH + 'px', left: (innerWidth - stageW) / 2 + 'px', top: (innerHeight - stageH) / 2 + 'px' });
  renderer.setSize(stageW, stageH);
  stage.style.setProperty('--sw', stageW + 'px');   // the profile phone scales with the stage
}
addEventListener('resize', layout); layout();

// ---- pointer ----
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pointer = null;            // {x, y} in stage px, or null when off the stage
let hovered = null;
function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  ndc.set(pointer.x / r.width * 2 - 1, 1 - pointer.y / r.height * 2);
  if (debug) { const d = $('#debug-info'); d.hidden = false; d.textContent = `img px ${Math.round(pointer.x / r.width * IMG_W)}, ${Math.round(pointer.y / r.height * IMG_H)}`; }
}
canvas.addEventListener('pointermove', setPointer);
canvas.addEventListener('pointerleave', () => { pointer = null; });

function updateHover() {
  let a = null;
  if (pointer && state === 'playing') { raycaster.setFromCamera(ndc, camera); a = crowd.pick(raycaster); }
  if (checking) {                              // during an ID check only the person being checked is clickable
    a = a === checking ? a : null;
    if (a !== hovered) { crowd.setHighlight(hovered, false); crowd.setHighlight(a, true); hovered = a; }
    canvas.className = a ? 'on-person' : 'pointing';
    card.show(null);
    return;
  }
  if (a !== hovered) { crowd.setHighlight(hovered, false); crowd.setHighlight(a, true); hovered = a; }
  canvas.className = state === 'playing' ? (a ? 'on-person' : 'pointing') : '';
  card.show(a, pointer?.x, pointer?.y, stageW, stageH);
}

// ---- ID check: first click calls someone up to the camera and shows their LinkedIn-style profile; clicking them again
// freezes them (right or wrong), clicking anywhere else releases them ----
let checking = null, deciding = false, needPhoto = false;

function startCheck(a) {
  checking = a; deciding = false;
  crowd.setHighlight(hovered, false); hovered = null; card.show(null);
  profile.open(a);
  crowd.inspect(a, () => { needPhoto = true; });   // profile photo once they're standing in front of the camera
}

function endCheck(stampKind, sub, delay) {
  const a = checking;
  deciding = true; profile.stamp(stampKind, sub); profile.close(delay);
  setTimeout(() => {
    if (checking !== a) return;
    if (stampKind !== 'frozen' && !a.frozen) crowd.release(a);
    crowd.setHighlight(a, false); checking = null; deciding = false;
    if (caught === crowd.ceoCount && state === 'playing') endRound(true);
  }, delay * 1000);
}

function cancelCheck() {                          // round over / restart: drop everything immediately
  if (checking && !checking.frozen) crowd.release(checking);
  checking = null; deciding = false; needPhoto = false; profile.close(0);
}

// ---- round ----
let state = 'start', timeLeft = ROUND_TIME, caught = 0, wrong = 0, lastTick = 0;

function startRound() {
  sfx.unlock();
  cancelCheck(); crowd.reset(); hovered = null; card.show(null);
  timeLeft = ROUND_TIME; caught = 0; wrong = 0; lastTick = 0;
  hud.timer(timeLeft); hud.caught(0, crowd.ceoCount); hud.show(true);
  showScreen(null); state = 'playing';
}

function endRound(won) {
  state = 'over'; cancelCheck(); card.show(null); crowd.setHighlight(hovered, false); hovered = null;
  sfx.end(won);
  $('#over-title').textContent = won ? 'All CEOs frozen! ❄' : "Time's up!";
  const bosses = [...crowd.agents, ...crowd.retired].filter((a) => a.isCEO);   // incl. frozen ones already sent off
  const list = (as) => as.map((a) => a.name).join(', ');
  const frozen = bosses.filter((a) => a.frozen), escaped = bosses.filter((a) => !a.frozen);
  const stats = $('#over-stats'); stats.replaceChildren();
  const line = (html) => { const d = document.createElement('div'); d.innerHTML = html; stats.append(d); return d; };
  line(`You froze <b>${caught} of ${crowd.ceoCount}</b> bosses` + (won ? ` with <b>${Math.ceil(timeLeft)} s</b> to spare` : '') + `. Wrong catches: ${wrong}`);
  if (frozen.length) line('').append(Object.assign(document.createElement('span'), { className: 'names', textContent: `❄ Frozen: ${list(frozen)}` }));
  if (escaped.length) line('').append(Object.assign(document.createElement('span'), { className: 'names', textContent: `🏃 Got away: ${list(escaped)}` }));
  showScreen('over-screen');
}

canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  if (debug) console.log('img px', $('#debug-info').textContent);
  if (state !== 'playing') return;
  raycaster.setFromCamera(ndc, camera);
  const a = crowd.pick(raycaster);
  if (checking) {
    if (deciding) return;                                     // a stamp is already coming down
    if (a !== checking) { endCheck('released', null, 0.6); return; }   // clicked off them: let them go
    if (a.isCEO) {
      crowd.freezeAndSendOff(a, 1.0); caught++; timeLeft += BONUS;
      popup(pointer.x, pointer.y, `❄ ${a.name} +${BONUS}s`, 'good'); snowBurst(pointer.x, pointer.y); sfx.freeze();
      hud.caught(caught, crowd.ceoCount);
      endCheck('frozen', a.name, 1.3);
    } else {
      timeLeft = Math.max(0, timeLeft - PENALTY); wrong++;
      crowd.shake(a); popup(pointer.x, pointer.y, `−${PENALTY}s`, 'bad'); wrongFlash(); sfx.wrong();
      endCheck('innocent', `−${PENALTY}s`, 1.1);
    }
    return;
  }
  if (!a || a.frozen) return;
  startCheck(a);
});

$('#start').onclick = startRound;
if (debug) { startRound(); window.__game = { crowd, camera, THREE, startCheck, endCheck: (k) => endCheck(k, null, 0.6) }; } // ?debug skips the start screen; __game is for tuning from the console
$('#restart').onclick = startRound;
$('#sound').onclick = () => { $('#sound').textContent = sfx.toggleMute() ? '🔇' : '🔊'; };

// ---- loop ----
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  crowd.update(dt);                       // the crowd keeps walking behind the start/end screens too
  if (state === 'playing') {
    timeLeft -= dt;
    const s = Math.ceil(timeLeft);
    if (s <= 10 && s > 0 && s !== lastTick) { lastTick = s; sfx.tick(); }
    hud.timer(Math.max(0, timeLeft));
    if (timeLeft <= 0) endRound(false);
  }
  if (needPhoto && checking) { needPhoto = false; profile.photo(); }
  renderer.render(scene, camera);
  updateHover();
});
