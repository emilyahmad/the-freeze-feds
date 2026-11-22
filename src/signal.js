// The pedestrian signal in the street photo, driven by the game: the steady orange "don't walk" hand
// (#walk-sign overlay) before a round, the photo's own WALK man during it, and when the round ends the hand
// blinks for a moment (like a real countdown) and then holds steady. While WALK shows, the accessible-signal
// tick loops in the background (sfx.walkLoop).
import { walkLoop } from './sfx.js';

const BLINK = 0.5, BLINK_TIME = 2;   // seconds

export function createSignal(el = document.getElementById('walk-sign')) {
  let timer = 0;
  const set = (stop, dark = false) => { el?.classList.toggle('stop', stop); el?.classList.toggle('dark', dark); };
  set(true);
  return {
    /** WALK: the photo's walk man shows. */
    walk() { clearInterval(timer); set(false); walkLoop(true); },
    /** Don't walk: with `blink`, the hand flashes for BLINK_TIME s first, then holds steady. */
    stop({ blink = false } = {}) {
      clearInterval(timer); walkLoop(false);
      if (!blink) return set(true);
      const t0 = performance.now();
      timer = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        if (t >= BLINK_TIME) { clearInterval(timer); set(true); }
        else set(true, Math.floor(t / BLINK) % 2 === 1);
      }, 100);
      set(true);
    },
  };
}
