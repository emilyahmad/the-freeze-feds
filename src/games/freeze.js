// Freeze Feds: the original game, as a mode. Hover anyone to inspect them; click someone to call them up to the
// camera and show their LinkedIn-style profile; click them again to freeze them and send them off down the street
// (right or wrong), anywhere else to let them go. Right catch +BONUS s, wrong −PENALTY s; ends at 0 s or when every CEO is frozen.
import { hud, popup, snowBurst, wrongFlash } from '../ui.js';
import * as sfx from '../sfx.js';

export const ROUND_TIME = 60;
const BONUS = 10, PENALTY = 10;

export function createFreeze(ctx, { time = ROUND_TIME, onDone }) {
  const { crowd, card, profile, raycaster, ndc, camera, canvas } = ctx;
  let timeLeft = time, caught = 0, wrong = 0, lastTick = 0, active = true;
  let checking = null, deciding = false, needPhoto = false, hovered = null;
  const frozen = [];

  sfx.unlock();
  crowd.reset();
  hud.timer(timeLeft); hud.caught(0, crowd.ceoCount); hud.show(true);

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
      if (caught === crowd.ceoCount && active) end(true);
    }, delay * 1000);
  }

  /** Let the person being checked go right away (no stamp); if the click landed on someone else, check them next. */
  function releaseNow(next) {
    const a = checking;
    checking = null; deciding = false; needPhoto = false;
    if (!a.frozen) { crowd.release(a); crowd.markReleased(a); }
    profile.close(0);
    if (next && !next.frozen) startCheck(next);
  }

  function cancelCheck() {                          // round over / quit: drop everything immediately
    if (checking && !checking.frozen) crowd.release(checking);
    checking = null; deciding = false; needPhoto = false; profile.close(0);
  }

  function end(won) {
    if (!active) return;
    active = false; cancelCheck(); card.show(null); crowd.setHighlight(hovered, false); hovered = null;
    sfx.end(won);
    const bosses = [...crowd.agents, ...crowd.retired].filter((a) => a.isCEO);   // incl. frozen ones already sent off
    onDone?.({ won, caught, wrong, timeLeft: Math.max(0, timeLeft), ceoCount: crowd.ceoCount,
      frozen, escaped: bosses.filter((a) => !a.frozen) });
  }

  return {
    startCheck, endCheck: (k) => endCheck(k, null, 0.6),

    update(dt) {
      if (needPhoto && checking) { needPhoto = false; profile.photo(); }
      if (!active) return;
      timeLeft -= dt;
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
      if (checking) card.show(null);
      else { const { w, h } = ctx.size(); card.show(a, pointer?.x, pointer?.y, w, h); }
    },

    down(pointer) {
      if (!active) return;
      raycaster.setFromCamera(ndc, camera);
      const a = crowd.pick(raycaster);
      if (checking) {
        if (deciding) return;                                     // a stamp is already coming down
        if (a !== checking) { releaseNow(a); return; }   // clicked off them: let them go at once (and check whoever was clicked)
        if (a.isCEO) {
          crowd.freezeAndSendOff(a, 1.0); caught++; timeLeft += BONUS; frozen.push(a);
          popup(pointer.x, pointer.y, `❄ ${a.name} +${BONUS}s`, 'good'); snowBurst(pointer.x, pointer.y); sfx.freeze();
          hud.caught(caught, crowd.ceoCount);
          endCheck('frozen', a.name, 1.3);
        } else {
          // wrong person: they're frozen and sent off all the same, but it costs PENALTY seconds
          crowd.freezeAndSendOff(a, 1.0); timeLeft = Math.max(0, timeLeft - PENALTY); wrong++;
          popup(pointer.x, pointer.y, `❄ Innocent! −${PENALTY}s`, 'bad'); snowBurst(pointer.x, pointer.y); wrongFlash(); sfx.freeze(); sfx.wrong();
          endCheck('innocent', `−${PENALTY}s`, 1.3);
        }
        return;
      }
      if (!a || a.frozen) return;
      startCheck(a);
    },

    /** Quit without a result (back to the home screen). */
    stop() { active = false; cancelCheck(); card.show(null); crowd.setHighlight(hovered, false); },
  };
}
