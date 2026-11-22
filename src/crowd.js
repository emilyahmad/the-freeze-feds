import * as THREE from 'three';
import { resetProfileDeck } from './ui.js';
import { makePerson, randomLook, ceoLook, assistantLook, describe, pose, encase, resetFaceDeck, CEO_TYPES, HIGHLIGHT } from './characters.js';

export const NORMALS = 20;
const WALK_SPEED = 0.75, SPEED_WALKER = 1.45, PACE_SPEED = 0.42, LEAD_SPEED = 0.6, SLOW_SPEED = 0.32, LOITER_SPEED = 0.5;
const STEP_RATE = [1.5, 5.5];          // walk-cycle speed (rad/s) = a + b × speed, so steps match the ground speed
// collisions: everyone is a solid circle on the ground (frozen bosses are bigger, immovable ice blocks)
const RADIUS = 0.27, ICE_RADIUS = 0.5;
const LOOK_AHEAD = 1.1;                // how far ahead walkers start stepping around people
const BUMP_TIME = 0.45, BUMP_LEAN = 0.22, BUMP_MIN = 0.03;   // lean-away wobble when bumped (MIN: push depth in m)
const STUCK_TIME = 1.1;                // blocked this long → pick somewhere else to go
// roaming: each new destination is a random spot NEAR_MIN..NEAR_MAX m away in any direction (NEAR_CHANCE),
// otherwise a random spot anywhere in the walk area (sampled evenly over the image, so mostly near the camera)
const NEAR_CHANCE = 0.35, NEAR_MIN = 2.5, NEAR_MAX = 6;
const RETARGET_RATE = 0.1;             // wanderers change their mind mid-walk this often (per second)
// mingling (like Miis in the Mii Channel / Plaza): wanderers walk up to someone nearby and form a little chat
// circle of up to CHAT_MAX, take turns talking (hand gestures), nod, sometimes laugh, then wave and part ways.
// People passing close by sometimes wave at each other. Bosses don't mingle, so their tells stay readable.
const CHAT_RADIUS = 3.2;               // how far they'll go to join someone (m)
const CHAT_MAX = 3;
const CHAT_TIME = [4, 8];              // how long a conversation lasts once everyone has arrived (s)
const CHAT_LIMIT = 14;                 // hard cap including gathering, so a circle can't stall (s)
const CHAT_CHANCE = 0.5;               // when ready to mingle, chance they actually go and chat
const SOCIAL_CD = [12, 24];            // after a chat, how long before they look for another one (s)
const TURN_TIME = [1.4, 3.2];          // each speaking turn (s)
const LAUGH_CHANCE = 0.3, NOD_CHANCE = 0.55;   // per speaking turn, for the listeners
// ID check: the clicked person walks up to this spot near the camera (world metres; the camera is at the
// origin looking down −z) and faces it; INSPECT_SPEED is a brisk "yes officer?" walk
const INSPECT_SPOT = new THREE.Vector3(0.9, 0, -2.2), INSPECT_SPEED = 2.6;
// released people walk RELEASE_SPEEDUP× faster for RELEASE_HURRY s, so they clear the front of the street quickly
const RELEASE_SPEEDUP = 2.5, RELEASE_HURRY = 2.2;
// released people stay marked (design-references/released-mii-outline.png): washed green, with a mint outline
const RELEASED_TINT = new THREE.Color('#3f8a5e'), RELEASED_TINT_AMT = 0.5, RELEASED_OUTLINE = 0x6fd1b6;
// send-off: a frozen boss's ice block slides away down the street, spinning gently, and fades out over the
// second half of the trip; then it's taken out of the scene
const SENDOFF_TIME = 6, SENDOFF_DIST = 30, SENDOFF_SPIN = 0.7, FADE_FROM = 0.45;
// entrance: at the start of a round everyone walks in from just past the left or right edge of the photo
// (ENTER_MARGIN m out, at a random depth), staggered by up to ENTER_SPREAD s, a little brisker than usual
const ENTER_MARGIN = [0.6, 2.5], ENTER_SPREAD = 4, ENTER_SPEEDUP = 1.3;
const GREET_DIST = 1.7, GREET_CHANCE = 0.5, GREET_CD = [6, 12];   // waving at passers-by

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); };

export class Crowd {
  constructor(scene, area) {
    this.scene = scene; this.area = area; this.agents = []; this.hitboxes = []; this.groups = []; this.retired = []; this.time = 0;
    this.ceoCount = CEO_TYPES.length;   // the street starts empty: reset() (at the start of a round) brings everyone in
  }

  reset() {
    for (const a of this.agents) this.scene.remove(a.person);
    this.agents = []; this.hitboxes = []; this.groups = []; this.retired = []; resetFaceDeck(); resetProfileDeck();
    for (let i = 0; i < NORMALS; i++) this.spawn(randomLook(), 'wander', false, true);
    for (const type of CEO_TYPES) {
      const ceo = this.spawn(ceoLook(type), type.behavior, true, true);
      if (type.behavior === 'lead') {          // two assistants flank the CEO
        for (const side of [-1, 1]) {
          const f = this.spawn(assistantLook(), 'follow', false);
          f.leader = ceo; f.offset = new THREE.Vector3(side * 0.75, 0, -0.45);
          f.person.position.copy(ceo.person.position).add(f.offset);
          if (ceo.entering) f.entering = true; else this.area.clamp(f.person.position);
        }
      }
    }
    this.ceoCount = CEO_TYPES.length;
  }

  /** Add someone. With `enter` they start off the side of the photo and walk in (see enterStep). */
  spawn(look, behavior, isCEO, enter = false) {
    const person = makePerson(look);
    person.position.copy(this.area.randomPoint());
    const a = {
      person, behavior, isCEO, info: describe(look), name: look.name || null, target: null,
      heading: rand(-Math.PI, Math.PI), phase: Math.random() * 10, amp: 0, pause: 0, frozen: false,
      pitchT: 0, pitchCd: rand(1, 4), shakeT: 0, mode: 'walk',
      bumpT: 0, bumpX: 0, bumpZ: 0, stuckT: 0, side: Math.random() < 0.5 ? -1 : 1,
      // social state: chat group, timers for waves / nods / laughs / looking at someone, and the pose overlay
      group: null, inPlace: false, chatWait: 0, socialCd: rand(1, 8), greetCd: rand(0, 4),
      waveT: 0, nodT: 0, laughT: 0, lookAt: null, lookT: 0, idleLookT: rand(1, 4), idleYaw: 0,
      fx: { talk: 0, wave: 0, nod: 0, laugh: 0, yaw: 0, hand: Math.random() < 0.5 ? -1 : 1, seed: Math.random() * 10 },
    };
    a.target = this.pickTarget(a);
    if (enter) {                               // walk in from the nearer-ish side, to a spot inside the street
      const side = Math.random() < 0.5 ? -1 : 1;
      person.position.copy(this.area.offscreen(person.position, side, rand(...ENTER_MARGIN)));
      a.entering = true; a.enterDelay = rand(0, ENTER_SPREAD); a.target = this.area.randomPoint();
      a.heading = side < 0 ? Math.PI / 2 : -Math.PI / 2;                     // facing into the street
    } else this.startBehavior(a);
    person.userData.hitbox.userData.agent = a;
    person.rotation.y = a.heading;
    this.scene.add(person); this.agents.push(a); this.hitboxes.push(person.userData.hitbox);
    return a;
  }

  /** Behaviour setup once someone is on the street. */
  startBehavior(a) {
    if (a.behavior === 'pace') {               // pace back and forth between two spots a few metres apart
      a.paceA = a.person.position.clone(); a.paceB = this.area.randomNear(a.paceA, 2, 3.2);
      a.target = a.paceB;
    }
  }

  /** Walking onto the street: wait out the stagger, then head for the first spot; done once well inside. */
  enterStep(a, dt) {
    if (a.enterDelay > 0) { a.enterDelay -= dt; a.speedNow = 0; return; }
    const speed = (a.behavior === 'speed' ? SPEED_WALKER : (a.walkSpeed ??= rand(0.85, 1.25) * WALK_SPEED)) * ENTER_SPEEDUP;
    if (this.move(a, speed, dt)) a.target = this.area.randomPoint();
  }

  /** A new place to walk to: usually somewhere close by in a random direction, sometimes anywhere. */
  pickTarget(a) {
    const p = a.person.position;
    return Math.random() < NEAR_CHANCE ? this.area.randomNear(p, NEAR_MIN, NEAR_MAX) : this.area.randomPoint();
  }

  nextWaypoint(a) { a.target = this.pickTarget(a); }


  /** Move toward a.target, stepping around people ahead; returns true on arrival. */
  move(a, speed, dt) {
    const p = a.person.position, dx = a.target.x - p.x, dz = a.target.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.08) { a.speedNow = 0; return true; }
    let ux = dx / dist, uz = dz / dist;
    const [sx, sz] = this.avoid(a, ux, uz, dist);
    ux += sx; uz += sz; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
    if (a.hurryT > 0) speed *= RELEASE_SPEEDUP;
    const step = Math.min(dist, speed * dt);
    p.x += ux * step; p.z += uz * step;
    a.speedNow = step / dt;
    a.heading = angleLerp(a.heading, Math.atan2(ux, uz), dt * 8);
    return false;
  }

  /** Sideways steer away from people in front of a walker heading (ux, uz). */
  avoid(a, ux, uz, dist) {
    const p = a.person.position; let sx = 0, sz = 0;
    for (const o of this.agents) {
      if (o === a || o === a.leader || o.leader === a) continue;
      const rx = o.person.position.x - p.x, rz = o.person.position.z - p.z, d = Math.hypot(rx, rz);
      if (d < 1e-4 || d > LOOK_AHEAD || d > dist + RADIUS * 2) continue;      // ignore people beyond the target
      const ahead = (rx * ux + rz * uz) / d;
      if (ahead < 0.2) continue;
      const lat = rx * -uz + rz * ux;                                            // + means they're on our left
      const away = Math.abs(lat) < 0.05 ? a.side : -Math.sign(lat);
      const w = ahead * (1 - d / LOOK_AHEAD) * (o.frozen ? 2.2 : 1.4);
      sx += -uz * away * w; sz += ux * away * w;
    }
    return [sx, sz];
  }

  /** Push overlapping people apart. Standing people are heavier than walkers; ice blocks don't move. */
  collide() {
    const A = this.agents, n = A.length;
    for (const a of A) a.onIce = false;
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < n; i++) {
        const a = A[i], pa = a.person.position, ra = a.frozen ? ICE_RADIUS : RADIUS;
        for (let j = i + 1; j < n; j++) {
          const b = A[j], pb = b.person.position, rb = b.frozen ? ICE_RADIUS : RADIUS;
          let dx = pb.x - pa.x, dz = pb.z - pa.z, d = Math.hypot(dx, dz);
          const overlap = ra + rb - d;
          if (overlap <= 0 || (a.frozen && b.frozen)) continue;
          if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }
          dx /= d; dz /= d;
          const ia = a.frozen ? 0 : (a.speedNow ? 1 : 0.4), ib = b.frozen ? 0 : (b.speedNow ? 1 : 0.4);   // inverse mass
          const ka = overlap * ia / (ia + ib), kb = overlap * ib / (ia + ib);
          pa.x -= dx * ka; pa.z -= dz * ka; pb.x += dx * kb; pb.z += dz * kb;
          if (a.frozen) b.onIce = true; if (b.frozen) a.onIce = true;
          if (iter === 0) { this.bump(a, -dx, -dz, ka); this.bump(b, dx, dz, kb); }
        }
      }
      // pushes can't shove people off the walk area, except off an ice block (clamping them back into the
      // ice would pin them there for good; they walk back in by themselves)
      for (const a of A) if (!a.frozen && !a.onIce && !a.inspect && !a.returning && !a.entering) this.area.clamp(a.person.position);
    }
  }

  /** Start a lean-away wobble for a push of `depth` metres in world direction (dx, dz). */
  bump(a, dx, dz, depth) {
    if (a.frozen || depth < BUMP_MIN || a.bumpT > BUMP_TIME * 0.5) return;
    a.bumpT = BUMP_TIME; a.bumpX = dx; a.bumpZ = dz;
    a.bumpAmt = Math.min(1, depth / 0.06);
  }

  // pauses: chance of stopping at each waypoint, and for how long [min, max] seconds
  wander(a, dt, speed, pauses, chanceToStop = 0.35, [lo, hi] = [0.4, 2]) {
    if (a.behavior === 'wander' && (a.socialCd -= dt) <= 0 && this.seekChat(a)) return;
    if (a.pause > 0) { a.pause -= dt; a.speedNow = 0; return; }
    if (a.stuckT > STUCK_TIME) { a.stuckT = 0; this.nextWaypoint(a); }        // blocked: go somewhere else
    if (a.behavior === 'wander' && Math.random() < RETARGET_RATE * dt) this.nextWaypoint(a);   // change of mind
    if (this.move(a, speed, dt)) { this.nextWaypoint(a); if (pauses && Math.random() < chanceToStop) a.pause = rand(lo, hi); }
  }

  // ---- mingling ----

  /** Look for someone nearby to chat with (or a chat circle with room) and join them. */
  seekChat(a) {
    const p = a.person.position;
    let best = null, bd = CHAT_RADIUS;
    for (const o of this.agents) {
      if (o === a || o.behavior !== 'wander' || o.frozen || o.inspect || o.entering) continue;
      if (o.group ? (o.group.members.length >= CHAT_MAX || o.group.t < 2) : o.socialCd > 2) continue;
      const d = o.person.position.distanceTo(p);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) { a.socialCd = rand(1, 3); return false; }         // nobody around: try again soon
    if (Math.random() > CHAT_CHANCE) { a.socialCd = rand(4, 8); return false; }   // not in the mood
    let g = best.group;
    if (!g) {
      const center = this.area.clamp(p.clone().lerp(best.person.position, 0.5));
      g = { members: [best], center, t: rand(...CHAT_TIME), age: 0, speaker: null, speakT: rand(0.6, 1.2) };
      this.groups.push(g); this.enterChat(best, g);
    }
    g.members.push(a); this.enterChat(a, g);
    this.layoutGroup(g);
    return true;
  }

  enterChat(a, g) { a.group = g; a.inPlace = false; a.chatWait = 0; a.pause = 0; }

  /** Spread the members evenly around the centre, keeping their current order so nobody crosses over. */
  layoutGroup(g) {
    const n = g.members.length, r = n === 2 ? 0.55 : 0.68, c = g.center;
    const ang = (m) => Math.atan2(m.person.position.x - c.x, m.person.position.z - c.z);
    const sorted = [...g.members].sort((x, y) => ang(x) - ang(y)), base = ang(sorted[0]);
    sorted.forEach((m, i) => {
      const t = base + i * Math.PI * 2 / n;
      m.slot = this.area.clamp(new THREE.Vector3(c.x + Math.sin(t) * r, 0, c.z + Math.cos(t) * r));
    });
  }

  /** Leave a chat circle (waving goodbye) and head off somewhere. */
  leaveChat(a, wave = true) {
    const g = a.group; if (!g) return;
    g.members.splice(g.members.indexOf(a), 1);
    a.group = null; a.inPlace = false; a.lookAt = null; a.socialCd = rand(...SOCIAL_CD);
    a.target = this.area.randomNear(a.person.position, NEAR_MIN, NEAR_MAX);
    if (wave) a.waveT = rand(0.7, 1.0);
    if (g.speaker === a) g.speaker = null;
    if (g.members.length < 2) {                                   // last one left: the circle is over
      for (const m of [...g.members]) this.leaveChat(m, wave);
      const i = this.groups.indexOf(g); if (i >= 0) this.groups.splice(i, 1);
    }
    else this.layoutGroup(g);
  }

  /** One member of a chat circle: walk to their spot, then face the middle and listen / talk. */
  chat(a, dt) {
    const g = a.group, p = a.person.position;
    if (!a.inPlace) {
      a.target = a.slot;
      if (this.move(a, (a.walkSpeed || WALK_SPEED) * 0.9, dt)) { a.inPlace = true; a.waveT = rand(0.6, 0.9); }   // "hi!"
      else if ((a.chatWait += dt) > 7 || a.stuckT > STUCK_TIME * 2) { a.stuckT = 0; this.leaveChat(a, false); }   // couldn't get there
      return;
    }
    a.speedNow = 0;
    a.heading = angleLerp(a.heading, Math.atan2(g.center.x - p.x, g.center.z - p.z), dt * 5);
    if (p.distanceTo(a.slot) > 0.35) a.inPlace = false;                      // got shoved out of place
    // look at whoever is talking; the talker looks around at their listeners
    if (g.speaker && g.speaker !== a) a.lookAt = g.speaker;
    else if (g.speaker === a && (!a.lookAt || a.lookAt.group !== g || Math.random() < dt * 0.6)) a.lookAt = pick(g.members.filter((m) => m !== a)) || null;
  }

  /** Once per frame per circle: run the clock, pass the turn around, trigger nods and laughs. */
  updateGroups(dt) {
    for (const g of [...this.groups]) {
      if (!this.groups.includes(g)) continue;
      if ((g.age += dt) > CHAT_LIMIT) { for (const m of [...g.members]) this.leaveChat(m, true); continue; }
      if (!g.members.every((m) => m.inPlace)) continue;                         // still gathering
      if ((g.t -= dt) <= 0) { for (const m of [...g.members]) this.leaveChat(m, true); continue; }
      if ((g.speakT -= dt) > 0) continue;
      const prev = g.speaker;
      g.speaker = pick(g.members.filter((m) => m !== prev)) || g.members[0];
      g.speakT = rand(...TURN_TIME);
      const laugh = Math.random() < LAUGH_CHANCE;
      for (const m of g.members) {
        if (m === g.speaker) continue;
        if (laugh) m.laughT = rand(0.7, 1.1);
        else if (Math.random() < NOD_CHANCE) m.nodT = rand(0.5, 0.9);
      }
      if (laugh && Math.random() < 0.5) g.speaker.laughT = rand(0.6, 0.9);
    }
  }

  /** A walker passing close in front of someone sometimes waves, and they wave back. */
  greet(a) {
    if (a.greetCd > 0 || a.group || a.inspect || a.behavior !== 'wander' || !(a.speedNow > 0.1)) return;
    const p = a.person.position, fx = Math.sin(a.heading), fz = Math.cos(a.heading);
    for (const o of this.agents) {
      if (o === a || o.frozen || o.group || o.inspect || o.greetCd > 0 || o.isCEO) continue;
      const dx = o.person.position.x - p.x, dz = o.person.position.z - p.z, d = Math.hypot(dx, dz);
      if (d > GREET_DIST || (dx * fx + dz * fz) / d < 0.3) continue;
      a.greetCd = o.greetCd = rand(...GREET_CD);
      if (Math.random() > GREET_CHANCE) return;
      for (const [x, y] of [[a, o], [o, a]]) { x.waveT = rand(0.7, 1.0); x.lookAt = y; x.lookT = 1.4; }
      return;
    }
  }

  /** Turn the social timers into the smoothed pose overlay that pose() reads. */
  updateFx(a, dt) {
    const fx = a.fx, k = Math.min(1, dt * 7), ease = (v, on) => v + ((on ? 1 : 0) - v) * k;
    a.waveT = Math.max(0, a.waveT - dt); a.nodT = Math.max(0, a.nodT - dt); a.laughT = Math.max(0, a.laughT - dt);
    a.greetCd -= dt;
    if (a.lookT > 0 && (a.lookT -= dt) <= 0 && !a.group) a.lookAt = null;
    fx.wave = ease(fx.wave, a.waveT > 0);
    fx.talk = ease(fx.talk, a.group && a.group.speaker === a && a.inPlace);
    fx.nod = ease(fx.nod, a.nodT > 0);
    fx.laugh = ease(fx.laugh, a.laughT > 0);
    // head turn: toward whoever they're looking at, or idle glances around while standing still
    let yaw = 0;
    if (a.inspect) a.lookAt = null;                                            // eyes front for the ID check
    else if (a.lookAt && !a.lookAt.frozen) {
      const p = a.person.position, q = a.lookAt.person.position;
      let rel = Math.atan2(q.x - p.x, q.z - p.z) - a.heading;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      yaw = Math.max(-1, Math.min(1, rel));
    } else if (!(a.speedNow > 0.1)) {
      if ((a.idleLookT -= dt) <= 0) { a.idleLookT = rand(1.2, 3.5); a.idleYaw = Math.random() < 0.35 ? 0 : rand(-0.8, 0.8); }
      yaw = a.idleYaw;
    }
    fx.yaw += (yaw - fx.yaw) * Math.min(1, dt * 4);
  }

  update(dt) {
    this.time += dt;
    this.updateGroups(dt);
    for (const a of this.agents) {
      const person = a.person;
      if (a.frozen) {
        a.freezeT = Math.min(1, a.freezeT + dt * 5);
        a.block.scale.setScalar(0.6 + 0.4 * a.freezeT + Math.sin(a.freezeT * Math.PI) * 0.15);
        if (a.sendOff && (a.sendOff.t += dt / SENDOFF_TIME) > 0) this.sendOffStep(a, dt);
        continue;
      }
      a.mode = 'walk'; a.px = person.position.x; a.pz = person.position.z;
      if (a.hurryT > 0) a.hurryT -= dt;
      if (a.inspect) this.inspectStep(a, dt);
      else if (a.entering && a.behavior !== 'follow') this.enterStep(a, dt);
      else if (a.group) this.chat(a, dt);
      else if (a.behavior === 'follow' && a.leader.inspect) a.speedNow = 0;     // assistants wait while their boss is checked
      else switch (a.behavior) {
        case 'wander': this.wander(a, dt, a.walkSpeed ??= rand(0.85, 1.25) * WALK_SPEED, true); break;
        case 'speed': this.wander(a, dt, SPEED_WALKER, false); break;
        case 'lead': this.wander(a, dt, LEAD_SPEED, true); break;
        case 'slow': this.wander(a, dt, SLOW_SPEED, true, 0.5, [1, 2.5]); break;          // ambles along
        case 'loiter':                                                                    // stands still and watches
          this.wander(a, dt, LOITER_SPEED, true, 1, [4, 7]);
          if (a.pause > 0) a.heading = angleLerp(a.heading, Math.sin(this.time * 0.4 + a.phase) * 1.2, dt * 2);
          break;
        case 'pace':
          a.mode = 'phone';
          if (a.pause > 0) { a.pause -= dt; a.speedNow = 0; break; }
          if (a.stuckT > STUCK_TIME) { a.stuckT = 0; a.target = a.target === a.paceA ? a.paceB : a.paceA; }
          if (this.move(a, PACE_SPEED, dt)) { a.target = a.target === a.paceA ? a.paceB : a.paceA; a.pause = rand(0.3, 0.9); }
          break;
        case 'pitch':
          if (a.pitchT > 0) {                 // stopped, pitching at someone
            a.pitchT -= dt; a.speedNow = 0; a.mode = 'pitch';
            const q = a.pitchTo.person.position, p = person.position;
            a.heading = angleLerp(a.heading, Math.atan2(q.x - p.x, q.z - p.z), dt * 6);
            break;
          }
          a.pitchCd -= dt;
          if (a.pitchCd <= 0) {
            const mark = this.agents.find((o) => o !== a && !o.frozen && !o.inspect && !o.entering && o.person.position.distanceTo(person.position) < 1.8);
            if (mark) {
              a.pitchTo = mark; a.pitchT = rand(2.5, 3.5); a.pitchCd = rand(4, 7);
              if (mark.behavior === 'wander' && !mark.group) mark.pause = a.pitchT;
              mark.lookAt = a; mark.lookT = a.pitchT; mark.nodT = a.pitchT * 0.6;   // the mark turns and nods along
              break;
            }
          }
          this.wander(a, dt, WALK_SPEED, false); break;
        case 'follow': {
          if (a.leader.frozen) { a.behavior = 'wander'; a.target = this.pickTarget(a); break; }
          const L = a.leader, h = L.heading, o = a.offset;
          a.target = L.person.position.clone().add(new THREE.Vector3(o.x * Math.cos(h) + o.z * Math.sin(h), 0, -o.x * Math.sin(h) + o.z * Math.cos(h)));
          const d = a.target.distanceTo(person.position);
          if (this.move(a, Math.min(2.6, d * 3 + 0.2), dt) || d < 0.15) a.heading = angleLerp(a.heading, h, dt * 5);
          break;
        }
      }
      this.greet(a);
      this.updateFx(a, dt);
      const amp = Math.min(1, (a.speedNow || 0) / WALK_SPEED);
      a.amp += (amp - a.amp) * Math.min(1, dt * 10);
      a.phase += dt * (STEP_RATE[0] + (a.speedNow || 0) * STEP_RATE[1]);
      person.rotation.y = a.heading;
      pose(person, a.phase, a.amp, a.mode, this.time, a.fx);
      const body = person.userData.rig.body;
      body.rotation.x = 0;
      if (a.bumpT > 0) {                       // bumped: lean away from the push, then wobble back upright
        a.bumpT = Math.max(0, a.bumpT - dt);
        const e = a.bumpT / BUMP_TIME, k = BUMP_LEAN * a.bumpAmt * e * Math.cos((1 - e) * Math.PI * 3);
        const h = a.heading, lz = a.bumpX * Math.sin(h) + a.bumpZ * Math.cos(h), lx = a.bumpX * Math.cos(h) - a.bumpZ * Math.sin(h);
        body.rotation.x += lz * k; body.rotation.z -= lx * k;
      }
      if (a.shakeT > 0) { a.shakeT -= dt; body.rotation.z += Math.sin(this.time * 60) * 0.18 * (a.shakeT / 0.4); }
    }
    this.collide();
    for (const a of this.agents) if (a.returning && this.area.contains(a.person.position, 0.3)) a.returning = false;   // back in the crowd
    for (const a of this.agents) {                                       // walked onto the street: start their usual routine
      if (!a.entering || a.inspect || !this.area.contains(a.person.position, 0.6)) continue;
      if (a.behavior === 'follow' && a.leader.entering) continue;
      a.entering = false; this.startBehavior(a);
    }
    // stuck check: walking but barely getting anywhere (pinned against people or ice)
    for (const a of this.agents) {
      if (a.frozen || a.px === undefined) continue;
      const want = (a.speedNow || 0) * dt, got = Math.hypot(a.person.position.x - a.px, a.person.position.z - a.pz);
      a.stuckT = want > 0.002 && got < want * 0.35 ? a.stuckT + dt : Math.max(0, a.stuckT - dt);
    }
  }

  // ---- ID check ----

  /** Call someone up to the camera. onPresent(a) fires once they're standing there facing it. */
  inspect(a, onPresent) {
    if (a.group) this.leaveChat(a, false);
    if (a.entering) { a.entering = false; this.startBehavior(a); }
    a.inspect = 'approach'; a.onPresent = onPresent;
    a.home = a.person.position.clone(); a.pause = 0; a.pitchT = 0; a.returning = false; a.hurryT = 0;
    a.target = INSPECT_SPOT.clone();
  }

  inspectStep(a, dt) {
    const p = a.person.position;
    if (a.inspect === 'approach') {
      if (this.move(a, INSPECT_SPEED, dt) || (a.stuckT > STUCK_TIME && p.distanceTo(INSPECT_SPOT) < 1.2)) {
        a.inspect = 'present'; a.waveT = 0.9;                              // "hello!"
        const cb = a.onPresent; a.onPresent = null; cb?.(a);
      }
      return;
    }
    a.speedNow = 0;
    a.heading = angleLerp(a.heading, Math.atan2(-p.x, -p.z), dt * 6);        // face the camera (at the origin)
  }

  /** Let them go: they walk back to where they were picked from and carry on. */
  release(a) {
    a.inspect = null; a.onPresent = null; a.returning = true; a.stuckT = 0;
    a.hurryT = RELEASE_HURRY;                                            // hurry back out of the way
    a.target = a.behavior === 'pace' ? a.paceA : a.home.clone();
    a.socialCd = Math.max(a.socialCd, 4);
  }

  /** Freeze someone being inspected; after `delay` s the ice block slowly heads off into the distance and fades. */
  freezeAndSendOff(a, delay = 1.0) {
    a.inspect = null; a.onPresent = null;
    this.freeze(a);
    const p = a.person.position, dir = new THREE.Vector3(p.x * 0.25, 0, -1).normalize();   // down the street, away from the camera
    a.sendOff = { from: p.clone(), dir, t: -delay / SENDOFF_TIME, fading: false };
  }

  sendOffStep(a, dt) {
    const so = a.sendOff, k = Math.min(1, so.t), person = a.person;
    const e = k * k * (3 - 2 * k) * 0.6 + k * k * 0.4;                           // slow start, eases into the distance
    person.position.copy(so.from).addScaledVector(so.dir, e * SENDOFF_DIST);
    person.rotation.y += dt * SENDOFF_SPIN * (0.3 + k);
    if (k > 0 && !so.fading) this.startFade(a);
    if (k > FADE_FROM) this.setOpacity(a, 1 - (k - FADE_FROM) / (1 - FADE_FROM));
    if (k >= 1) this.retire(a);
  }

  /** Give the person (and their ice block) their own transparent copies of every material, so fading them doesn't
   *  fade anyone else sharing a material (drawn faces and the ice material are shared). Outlines are hidden. */
  startFade(a) {
    a.sendOff.fading = true;
    a.person.userData.setOutline(null);
    const i = this.hitboxes.indexOf(a.person.userData.hitbox); if (i >= 0) this.hitboxes.splice(i, 1);   // no more hover / clicks
    const fadeMats = a.sendOff.mats = [];
    const own = (m) => { if (!m.visible) return m; const c = m.clone(); c.transparent = true; c.userData.baseOpacity = m.opacity; fadeMats.push(c); return c; };
    a.person.traverse((o) => {
      if (!o.material || o === a.person.userData.hitbox) return;
      o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
    });
  }

  setOpacity(a, k) { for (const m of a.sendOff.mats) m.opacity = m.userData.baseOpacity * Math.max(0, k); }

  /** Gone for good: out of the scene and out of everyone's way (they still count as frozen for the score). */
  retire(a) {
    a.sendOff = null; a.gone = true;
    this.scene.remove(a.person);
    this.agents = this.agents.filter((o) => o !== a);
    this.retired.push(a);
  }

  /** Agent under the ray, or null. */
  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.hitboxes, false)[0];
    return hit ? hit.object.userData.agent : null;
  }

  setHighlight(a, on) { if (a && !a.frozen) a.person.userData.setOutline(on ? HIGHLIGHT : a.released ? RELEASED_OUTLINE : null); }

  /** Mark someone the player checked and let go: a green wash over them (face included) and a mint outline. */
  markReleased(a) {
    if (a.released || a.frozen) return;
    a.released = true;
    for (const m of a.person.userData.mats) m.color.lerp(RELEASED_TINT, RELEASED_TINT_AMT);
    a.person.userData.setOutline(RELEASED_OUTLINE);
  }

  freeze(a) {
    a.frozen = true; a.freezeT = 0;
    a.block = encase(a.person);
    pose(a.person, 0, 0, a.mode === 'pitch' ? 'pitch' : a.mode, this.time);
  }

  shake(a) { a.shakeT = 0.4; }
}
