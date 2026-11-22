// Freeze Feds: the original game, as a mode. Hover anyone to see their head up close (it swells, Find Mii style); click someone to call them up to the
// camera and show their LinkedIn-style profile; hit Freeze under the phone to open the webcam, then mime a throw (fist
// toward it, opening to a palm as it gets close) to throw a snowball: a boss is frozen and sent off down the street, an innocent throws one right back; click anywhere
// else to let them go. Right catch +BONUS s, wrong −PENALTY s; ends at 0 s or when every CEO is frozen.
// The clock is paused while the webcam is open. If the camera can't start, the button freezes them directly.
import * as THREE from 'three';
import { hud, popup, snowBurst, snowBack, snowSplot, clearSplots, wrongFlash } from '../ui.js';
import * as sfx from '../sfx.js';
import { ThrowCam, preloadHands } from '../throwcam.js';

export const ROUND_TIME = 60;
const BONUS = 10, PENALTY = 10;
const SNOWBALL_TIME = 0.45;   // flight time of the thrown snowball (s)
const BRACE_FROM = 0.45;
const PAYBACK_DELAY = 0.45, PAYBACK_TIME = 1.7;   // wrong person: pause before they throw back, then how long until they walk off      // they start to cower once the throw is this far along (0..1 of the camera's meter)
// finale (time ran out with bosses still loose): once they're lined up on the crosswalk they throw two volleys at the
// screen, left to right then back (VOLLEY_GAP s between throwers, VOLLEY_BREAK s between volleys); the splotches stay
// FINALE_HOLD s after the last one lands, then slide off as the over screen comes up
const FINALE_START = 0.5, VOLLEY_GAP = [0.32, 0.16], VOLLEY_BREAK = 0.8, FINALE_HOLD = 1.4;
const SPLOT_SIZE = [22, 32];  // splotch size on the screen, vmin

let cam = null, noCam = false;   // one webcam panel for the page; noCam once the camera has failed to start
const _v = new THREE.Vector3();

export function createFreeze(ctx, { time = ROUND_TIME, onEnd, onDone }) {
  const { crowd, profile, raycaster, ndc, camera, canvas, size } = ctx;
  let timeLeft = time, caught = 0, wrong = 0, lastTick = 0, active = true;
  let checking = null, deciding = false, needPhoto = false, hovered = null, splatted = false;
  const frozen = [];
  let alive = true;                                  // false once the mode is stopped (finale timers check it)
  const timers = [], later = (secs, fn) => timers.push(setTimeout(() => { if (alive) fn(); }, secs * 1000));
  clearSplots(true);

  sfx.unlock();
  crowd.reset();
  hud.timer(timeLeft); hud.caught(0, crowd.ceoCount); hud.show(true);
  cam ??= new ThrowCam();
  if (!noCam) preloadHands().catch(() => {});      // warm up the hand tracker so the first Freeze opens quickly
  const freezeBtn = document.querySelector('#pf-freeze');
  freezeBtn.onclick = (e) => { e.stopPropagation(); openCam(); };
  const setButton = (on) => { freezeBtn.disabled = !on; freezeBtn.textContent = noCam ? '❄ Freeze (no camera)' : '❄ Freeze'; };

  /** Freeze button: open the webcam and wait for the throw (or, with no camera, throw right away). */
  function openCam() {
    if (!checking || deciding || !active) return;
    const a = checking;
    if (noCam) { throwAt(a); return; }
    setButton(false);
    cam.open({
      onThrow: () => { if (checking === a && !deciding && active) throwAt(a); },
      onCharge: (f) => {                    // nearly thrown: they see it coming and start to cower
        if (checking !== a || deciding) return;
        const k = Math.max(0, (f - BRACE_FROM) / (1 - BRACE_FROM));
        crowd.brace(a, k * k * (3 - 2 * k));
      },
      onCancel: () => { if (checking === a && !deciding) setButton(true); },
      onError: () => { noCam = true; if (checking === a && !deciding) setButton(true); },
    });
  }

  /** Where the person's head is on screen (stage px). */
  function headOnScreen(a) {
    const { headFrame, eyeY } = a.person.userData;
    a.person.updateMatrixWorld(true);
    return toScreen(headFrame.localToWorld(_v.set(0, eyeY, 0)));
  }
  function toScreen(p) {
    p.project(camera);
    const { w, h } = size();
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
  }

  /** A snowball flies up from the bottom of the screen and freezes them on impact. */
  function throwAt(a) {
    deciding = true; setButton(false);
    crowd.flinch(a, SNOWBALL_TIME + 0.3);   // cower until it lands (frozen mid-flinch), and the people nearby duck too
    const { w, h } = size(), to = headOnScreen(a), from = { x: w * 0.55, y: h + 40 };
    const el = Object.assign(document.createElement('div'), { className: 'snowball' });
    document.querySelector('#fx').append(el);
    const frames = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * h * 0.12;
      frames.push({ transform: `translate(${x}px, ${y}px) scale(${1.6 - 1.1 * t}) rotate(${t * 300}deg)` });
    }
    el.animate(frames, { duration: SNOWBALL_TIME * 1000, easing: 'cubic-bezier(.3, .4, .6, 1)' }).onfinish = () => {
      el.remove();
      if (checking === a && active) hit(a, headOnScreen(a));
      else deciding = false;
    };
  }

  /** The snowball lands: freeze them (right or wrong) with the stamp on the phone. */
  function hit(a, at) {
    snowBurst(at.x, at.y);
    if (a.isCEO) {
      crowd.freezeAndSendOff(a, 1.0); sfx.freeze();
      caught++; timeLeft += BONUS; frozen.push(a);
      popup(at.x, at.y, `❄ ${a.name} +${BONUS}s`, 'good');
      hud.caught(caught, crowd.ceoCount);
      endCheck('frozen', a.name, 1.3);
    } else {
      // wrong person: it costs PENALTY seconds, and they're not frozen: they shake the snow off, wind up and throw one
      // right back at the player, which splats over the screen and slides off (clock paused meanwhile), then they
      // laugh and walk off, marked as cleared
      timeLeft = Math.max(0, timeLeft - PENALTY); wrong++;
      popup(at.x, at.y, `Innocent! −${PENALTY}s`, 'bad'); wrongFlash(); sfx.wrong();
      a.shakeT = 0.4; splatted = true;
      later(PAYBACK_DELAY, () => {
        if (checking !== a) { splatted = false; return; }
        crowd.throwSnowball(a, () => {
          sfx.whoosh();
          a.person.updateMatrixWorld(true);
          const from = toScreen(a.person.userData.snowball.getWorldPosition(_v));
          snowBack(from, { text: `Innocent! −${PENALTY}s`, onImpact: () => sfx.splat(), onDone: () => { splatted = false; } });
        });
      });
      endCheck('innocent', `−${PENALTY}s`, PAYBACK_DELAY + PAYBACK_TIME);
    }
  }

  function startCheck(a) {
    checking = a; deciding = false;
    crowd.setHighlight(hovered, false); hovered = null; crowd.setHover(null);
    profile.open(a); setButton(true);
    crowd.inspect(a, () => { needPhoto = true; });   // profile photo once they're standing in front of the camera
  }

  function endCheck(stampKind, sub, delay) {
    const a = checking;
    deciding = true; profile.stamp(stampKind, sub); profile.close(delay);
    setTimeout(() => {
      if (checking !== a) return;
      if (stampKind !== 'frozen' && !a.frozen) { crowd.release(a); if (stampKind === 'innocent') crowd.markReleased(a); }
      crowd.setHighlight(a, false); checking = null; deciding = false;
      if (caught === crowd.ceoCount && active) end(true);
    }, delay * 1000);
  }

  /** Let the person being checked go right away (no stamp); if the click landed on someone else, check them next. */
  function releaseNow(next) {
    const a = checking;
    checking = null; deciding = false; needPhoto = false;
    cam.close();
    if (!a.frozen) { crowd.release(a); crowd.markReleased(a); }
    profile.close(0);
    if (next && !next.frozen) startCheck(next);
  }

  function cancelCheck() {                          // round over / quit: drop everything immediately
    cam.close();
    if (checking && !checking.frozen) crowd.release(checking);
    checking = null; deciding = false; needPhoto = false; profile.close(0);
  }

  function end(won) {
    if (!active) return;
    active = false; cancelCheck(); crowd.setHover(null); crowd.setHighlight(hovered, false); hovered = null;
    sfx.end(won); sfx.duckMurmur(false);
    const bosses = [...crowd.agents, ...crowd.retired].filter((a) => a.isCEO);   // incl. frozen ones already sent off
    const escaped = bosses.filter((a) => !a.frozen);
    const result = { won, caught, wrong, timeLeft: Math.max(0, timeLeft), ceoCount: crowd.ceoCount, frozen, escaped };
    onEnd?.(result);
    // time's up with bosses still loose: they stay and line up on the crosswalk to throw snowballs at the player;
    // everyone else heads off the street
    const line = won ? [] : escaped.filter((a) => crowd.agents.includes(a));
    crowd.exit(line);
    if (!line.length) { onDone?.(result); return; }
    crowd.lineUp(line, () => volleys(line, () => { clearSplots(); onDone?.(result); }));
  }

  /** The lined-up bosses each throw at the screen, left to right, then again right to left a bit faster. */
  function volleys(line, done) {
    const order = [...line, ...[...line].reverse()];
    let t = FINALE_START, landed = 0;
    order.forEach((a, i) => {
      if (i) t += i === line.length ? VOLLEY_BREAK : VOLLEY_GAP[i < line.length ? 0 : 1];
      later(t, () => crowd.throwSnowball(a, () => {
        sfx.whoosh();
        a.person.updateMatrixWorld(true);
        const from = toScreen(a.person.userData.snowball.getWorldPosition(_v)), { w, h } = size();
        const to = { x: w * (0.1 + Math.random() * 0.8), y: h * (0.12 + Math.random() * 0.7) };
        snowSplot(from, to, {
          size: SPLOT_SIZE[0] + Math.random() * (SPLOT_SIZE[1] - SPLOT_SIZE[0]),
          onImpact: () => { sfx.splat(); if (++landed === order.length) later(FINALE_HOLD, done); },
        });
      }));
    });
  }

  return {
    startCheck, endCheck: (k) => endCheck(k, null, 0.6),
    throwNow: () => checking && !deciding && throwAt(checking),   // skip the webcam (console / ?debug)
    timeUp: () => { timeLeft = 0; },                                // end the round now (console / ?debug)

    update(dt) {
      if (needPhoto && checking) { needPhoto = false; profile.photo(); }
      sfx.duckMurmur(active && checking?.inspect === 'present');   // chatter dips once they're up at the camera
      if (!active) return;
      if (!cam.isOpen && !splatted) timeLeft -= dt;  // the clock waits while they line up a throw, or can't see
      const s = Math.ceil(timeLeft);
      if (s <= 10 && s > 0 && s !== lastTick) { lastTick = s; sfx.tick(); }
      hud.timer(Math.max(0, timeLeft));
      if (timeLeft <= 0) end(false);
    },

    hover(pointer) {
      let a = null;
      if (pointer && active) { raycaster.setFromCamera(ndc, camera); a = crowd.pick(raycaster); }
      if (checking) a = a === checking ? a : null;   // during an ID check only the person being checked is clickable
      if (a !== hovered) { crowd.setHighlight(hovered, false); crowd.setHighlight(a, true); hovered = a; }
      canvas.className = active ? (a ? 'on-person' : 'pointing') : '';
      crowd.setHover(checking ? null : a);          // big head on hover (not on the person already up at the camera)
    },

    down(pointer) {
      if (!active) return;
      raycaster.setFromCamera(ndc, camera);
      const a = crowd.pick(raycaster);
      if (checking) {
        if (deciding) return;                                     // a stamp is already coming down
        if (a !== checking) releaseNow(a);   // clicked off them: let them go at once (and check whoever was clicked)
        return;                              // clicking them again does nothing: the Freeze button throws the snowball
      }
      if (!a || a.frozen) return;
      startCheck(a);
    },

    /** Quit without a result (back to the home screen). */
    stop() {
      active = false; alive = false; timers.forEach(clearTimeout); clearSplots(true); sfx.duckMurmur(false); cancelCheck(); crowd.setHover(null); crowd.setHighlight(hovered, false); },
  };
}
