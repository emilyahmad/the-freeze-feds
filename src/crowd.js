import * as THREE from 'three';
import { makePerson, randomLook, ceoLook, assistantLook, describe, pose, encase, CEO_TYPES, HIGHLIGHT } from './characters.js';

export const NORMALS = 20;
const WALK_SPEED = 1.1, SPEED_WALKER = 2.0, PACE_SPEED = 0.55, LEAD_SPEED = 0.85, SLOW_SPEED = 0.45, LOITER_SPEED = 0.7;
const JITTER = 0.7;
// collisions: everyone is a solid circle on the ground (frozen bosses are bigger, immovable ice blocks)
const RADIUS = 0.27, ICE_RADIUS = 0.5;
const LOOK_AHEAD = 1.1;                // how far ahead walkers start stepping around people
const BUMP_TIME = 0.45, BUMP_LEAN = 0.22, BUMP_MIN = 0.03;   // lean-away wobble when bumped (MIN: push depth in m)
const STUCK_TIME = 1.1;                // blocked this long → pick somewhere else to go                    // how far from a waypoint people aim, so they don't walk single file

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const jitter = (p, r = JITTER) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; return p.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)); };
const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * Math.min(1, t); };

export class Crowd {
  constructor(scene, graph) {
    this.scene = scene; this.graph = graph; this.agents = []; this.hitboxes = []; this.time = 0;
    this.reset();
  }

  reset() {
    for (const a of this.agents) this.scene.remove(a.person);
    this.agents = []; this.hitboxes = [];
    for (let i = 0; i < NORMALS; i++) this.spawn(randomLook(), 'wander', false);
    for (const type of CEO_TYPES) {
      const ceo = this.spawn(ceoLook(type), type.behavior, true);
      if (type.behavior === 'lead') {          // two assistants flank the CEO
        for (const side of [-1, 1]) {
          const f = this.spawn(assistantLook(), 'follow', false);
          f.leader = ceo; f.offset = new THREE.Vector3(side * 0.75, 0, -0.45);
          f.person.position.copy(ceo.person.position).add(f.offset);
        }
      }
    }
    this.ceoCount = CEO_TYPES.length;
  }

  spawn(look, behavior, isCEO) {
    const person = makePerson(look);
    const g = this.graph, [i, j] = pick(g.edges);
    person.position.lerpVectors(g.nodes[i], g.nodes[j], Math.random()).copy(jitter(person.position, 0.5));
    const a = {
      person, behavior, isCEO, info: describe(look), name: look.name || null, node: j, prev: i, target: jitter(g.nodes[j]),
      heading: rand(-Math.PI, Math.PI), phase: Math.random() * 10, amp: 0, pause: 0, frozen: false,
      pitchT: 0, pitchCd: rand(1, 4), shakeT: 0, mode: 'walk',
      bumpT: 0, bumpX: 0, bumpZ: 0, stuckT: 0, side: Math.random() < 0.5 ? -1 : 1,
    };
    if (behavior === 'pace') {                 // pace between a waypoint and the middle of one of its edges
      a.paceA = jitter(g.nodes[i], 0.3); a.paceB = jitter(g.nodes[i].clone().lerp(g.nodes[j], 0.45), 0.3);
      person.position.copy(a.paceA); a.target = a.paceB;
    }
    person.userData.hitbox.userData.agent = a;
    person.rotation.y = a.heading;
    this.scene.add(person); this.agents.push(a); this.hitboxes.push(person.userData.hitbox);
    return a;
  }

  nextWaypoint(a) {
    const nbrs = this.graph.adj[a.node], options = nbrs.filter((n) => n !== a.prev);
    a.prev = a.node; a.node = pick(options.length ? options : nbrs);
    a.target = jitter(this.graph.nodes[a.node]);
  }

  nearestNode(p) {
    let best = 0, bd = Infinity;
    this.graph.nodes.forEach((n, i) => { const d = n.distanceToSquared(p); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Move toward a.target, stepping around people ahead; returns true on arrival. */
  move(a, speed, dt) {
    const p = a.person.position, dx = a.target.x - p.x, dz = a.target.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.08) { a.speedNow = 0; return true; }
    let ux = dx / dist, uz = dz / dist;
    const [sx, sz] = this.avoid(a, ux, uz, dist);
    ux += sx; uz += sz; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
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
    for (let iter = 0; iter < 2; iter++) {
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
          if (iter === 0) { this.bump(a, -dx, -dz, ka); this.bump(b, dx, dz, kb); }
        }
      }
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
    if (a.pause > 0) { a.pause -= dt; a.speedNow = 0; return; }
    if (a.stuckT > STUCK_TIME) { a.stuckT = 0; this.nextWaypoint(a); }        // blocked: go somewhere else
    if (this.move(a, speed, dt)) { this.nextWaypoint(a); if (pauses && Math.random() < chanceToStop) a.pause = rand(lo, hi); }
  }

  update(dt) {
    this.time += dt;
    for (const a of this.agents) {
      const person = a.person;
      if (a.frozen) {
        a.freezeT = Math.min(1, a.freezeT + dt * 5);
        a.block.scale.setScalar(0.6 + 0.4 * a.freezeT + Math.sin(a.freezeT * Math.PI) * 0.15);
        continue;
      }
      a.mode = 'walk'; a.px = person.position.x; a.pz = person.position.z;
      switch (a.behavior) {
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
            const mark = this.agents.find((o) => o !== a && !o.frozen && o.person.position.distanceTo(person.position) < 1.8);
            if (mark) { a.pitchTo = mark; a.pitchT = rand(2.5, 3.5); a.pitchCd = rand(4, 7); if (mark.behavior === 'wander') mark.pause = a.pitchT; break; }
          }
          this.wander(a, dt, WALK_SPEED, false); break;
        case 'follow': {
          if (a.leader.frozen) { a.behavior = 'wander'; a.node = this.nearestNode(person.position); a.prev = -1; a.target = jitter(this.graph.nodes[a.node]); break; }
          const L = a.leader, h = L.heading, o = a.offset;
          a.target = L.person.position.clone().add(new THREE.Vector3(o.x * Math.cos(h) + o.z * Math.sin(h), 0, -o.x * Math.sin(h) + o.z * Math.cos(h)));
          const d = a.target.distanceTo(person.position);
          if (this.move(a, Math.min(2.6, d * 3 + 0.2), dt) || d < 0.15) a.heading = angleLerp(a.heading, h, dt * 5);
          break;
        }
      }
      const amp = Math.min(1, (a.speedNow || 0) / WALK_SPEED);
      a.amp += (amp - a.amp) * Math.min(1, dt * 10);
      a.phase += dt * (4 + (a.speedNow || 0) * 5.5);
      person.rotation.y = a.heading;
      pose(person, a.phase, a.amp, a.mode, this.time);
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
    // stuck check: walking but barely getting anywhere (pinned against people or ice)
    for (const a of this.agents) {
      if (a.frozen || a.px === undefined) continue;
      const want = (a.speedNow || 0) * dt, got = Math.hypot(a.person.position.x - a.px, a.person.position.z - a.pz);
      a.stuckT = want > 0.002 && got < want * 0.35 ? a.stuckT + dt : Math.max(0, a.stuckT - dt);
    }
  }

  /** Agent under the ray, or null. */
  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.hitboxes, false)[0];
    return hit ? hit.object.userData.agent : null;
  }

  setHighlight(a, on) { if (a && !a.frozen) a.person.userData.setOutline(on ? HIGHLIGHT : null); }

  freeze(a) {
    a.frozen = true; a.freezeT = 0;
    a.block = encase(a.person);
    pose(a.person, 0, 0, a.mode === 'pitch' ? 'pitch' : a.mode, this.time);
  }

  shake(a) { a.shakeT = 0.4; }
}
