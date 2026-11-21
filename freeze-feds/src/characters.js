import * as THREE from 'three';

// Placeholder chibi people: big round head, capsule body, toon shading with an outline.
// Later these can be swapped for SkeletonUtils.clone() of VRoid/VRM bases: crowd.js only relies on
// the returned Group, `userData.rig` (limbs to swing), `userData.mats` (to tint) and `userData.hitbox`.

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;

// ---- palettes: [hex, name] ----
const SKINS = ['#f6d5bd', '#eebf9a', '#d9a07a', '#b97d55', '#8d5a3b', '#5f3b26'];
const HAIRS = ['#2b1d14', '#4a2e1c', '#7a4a26', '#c58b4a', '#e8c070', '#9a9a9a', '#1a1a1a', '#a3322b'];
const SHIRTS = [['#e85d5d', 'Red'], ['#f2a541', 'Orange'], ['#f7d154', 'Yellow'], ['#6cc58c', 'Green'], ['#4fa3e0', 'Blue'],
  ['#8d7be8', 'Purple'], ['#e87fb8', 'Pink'], ['#ffffff', 'White'], ['#5ac8c8', 'Teal'], ['#d9d2c3', 'Beige'], ['#2a2a30', 'Black']];
const PANTS = ['#2f3e5c', '#3b3b3b', '#6b5b45', '#4a5d3a', '#22304a', '#7d6b5b'];
const ACCENTS = [['#e85d5d', 'red'], ['#4fa3e0', 'blue'], ['#f2a541', 'orange'], ['#6cc58c', 'green'], ['#8d7be8', 'purple'], ['#f7d154', 'yellow']];
const CEO_COLORS = [['#1b1b1f', 'Black'], ['#1e1e24', 'Black'], ['#8a8f98', 'Grey'], ['#9cc9ef', 'Light blue'], ['#1f2a44', 'Navy']];
const colorName = (hex, list = [...SHIRTS, ...CEO_COLORS]) => (list.find(([h]) => h === hex) || [, ''])[1];

// ---- Targets: parody caricatures of well-known tech and finance bosses ----
// Built from signature looks only (hair, outfit, a prop) on the generic chibi face.
// `info` is the hover-card line; `behavior` is their movement tell (see crowd.js).
export const CEO_TYPES = [
  { id: 'holmes', name: 'Elizabeth Holmes', behavior: 'pace', info: 'Black turtleneck, blonde bun, wide unblinking eyes, tiny blood-test gadget',
    look: { skin: '#f6dcc6', hair: '#e8c96a', hairStyle: 'bun', outfit: 'turtleneck', shirt: '#17171b', pants: '#17171b', bigEyes: true, carry: 'device' } },
  { id: 'zuckerberg', name: 'Mark Zuckerberg', behavior: 'speed', info: 'Plain grey tee, short curly hair, VR headset on',
    look: { skin: '#f3d2b8', hair: '#5a3a22', hairStyle: 'curly', shirt: '#8a8f98', pants: '#2f3e5c', headset: true } },
  { id: 'huang', name: 'Jensen Huang', behavior: 'pitch', info: 'Black leather jacket, silver hair, waving a graphics chip',
    look: { skin: '#e8c39e', hair: '#cfcfd4', hairStyle: 'swept', shirt: '#141418', jacket: '#141418', pants: '#141418', carry: 'gpu' } },
  { id: 'musk', name: 'Elon Musk', behavior: 'speed', info: 'Black tee, carrying a kitchen sink',
    look: { skin: '#f3d2b8', hair: '#3a2a20', hairStyle: 'short', shirt: '#17171b', pants: '#22222a', carry: 'sink' } },
  { id: 'thiel', name: 'Peter Thiel', behavior: 'loiter', info: 'Navy suit, open collar, receding hairline',
    look: { skin: '#f6dcc6', hair: '#b08a5a', hairStyle: 'receding', outfit: 'suit', shirt: '#1f2a44', pants: '#1f2a44', collar: '#ffffff', tie: null } },
  { id: 'karp', name: 'Alex Karp', behavior: 'pitch', info: 'Wild grey curls, bright scarf, athletic top',
    look: { skin: '#f3d2b8', hair: '#d8d8dc', hairStyle: 'puff', shirt: '#2c3e66', pants: '#22304a', scarf: '#e8556a' } },
  { id: 'gates', name: 'Bill Gates', behavior: 'pace', info: 'V-neck sweater over a collared shirt, round glasses',
    look: { skin: '#f6dcc6', hair: '#a58466', hairStyle: 'short', outfit: 'sweater', shirt: '#6d8fb3', pants: '#6b5b45', collar: '#ffffff', glasses: 'round' } },
  { id: 'bezos', name: 'Jeff Bezos', behavior: 'lead', info: 'Shiny bald head, sunglasses, puffer vest, carrying a cardboard box',
    look: { skin: '#f0c9a8', hair: '#f0c9a8', hairStyle: 'bald', outfit: 'vest', shirt: '#4f7fb8', vest: '#1c1c22', pants: '#2f3e5c', glasses: 'sun', carry: 'box' } },
  { id: 'dimon', name: 'Jamie Dimon', behavior: 'lead', info: 'Silver swept-back hair, dark suit, light blue shirt',
    look: { skin: '#f0c9a8', hair: '#e9e9ee', hairStyle: 'swept', outfit: 'suit', shirt: '#2b2f3a', pants: '#2b2f3a', collar: '#bcd7f2', tie: '#5a4a8a' } },
  { id: 'buffett', name: 'Warren Buffett', behavior: 'slow', info: 'White hair, bushy eyebrows, grey suit, can of soda',
    look: { skin: '#f6d5c4', hair: '#f2f2f4', hairStyle: 'short', outfit: 'suit', shirt: '#8f939b', pants: '#8f939b', collar: '#ffffff', tie: '#8a2b2b', glasses: 'round', brows: '#f2f2f4', carry: 'soda' } },
];

// ---- shared geometry ----
const legGeo = new THREE.CapsuleGeometry(0.075, 0.22, 4, 10).translate(0, -0.185, 0);  // pivot at hip
const armGeo = new THREE.CapsuleGeometry(0.06, 0.24, 4, 10).translate(0, -0.18, 0);    // pivot at shoulder
const torsoGeo = new THREE.CapsuleGeometry(0.21, 0.26, 6, 16);
const vestGeo = new THREE.CapsuleGeometry(0.228, 0.16, 6, 16);
const headGeo = new THREE.SphereGeometry(0.3, 28, 20);
const hairGeo = new THREE.SphereGeometry(0.318, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
const beanieGeo = new THREE.SphereGeometry(0.335, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);
const brimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 20, 1, false, -Math.PI / 2, Math.PI);
const eyeGeo = new THREE.SphereGeometry(0.036, 10, 8);
const blushGeo = new THREE.CircleGeometry(0.045, 14);
const lensGeo = new THREE.TorusGeometry(0.065, 0.013, 6, 18);
const shadeGeo = new THREE.BoxGeometry(0.13, 0.075, 0.03);
const barGeo = new THREE.BoxGeometry(0.08, 0.016, 0.016);
const phoneGeo = new THREE.BoxGeometry(0.085, 0.15, 0.018);
const budGeo = new THREE.SphereGeometry(0.035, 8, 6);
const neckGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.12, 18);
const hoodGeo = new THREE.TorusGeometry(0.19, 0.075, 8, 20);
const cordGeo = new THREE.TorusGeometry(0.17, 0.012, 6, 24);
const badgeGeo = new THREE.BoxGeometry(0.09, 0.12, 0.012);
const tieGeo = new THREE.BoxGeometry(0.055, 0.24, 0.02);
const collarGeo = new THREE.BoxGeometry(0.14, 0.12, 0.02);
const bagGeo = new THREE.BoxGeometry(0.26, 0.3, 0.08);
const strapGeo = new THREE.TorusGeometry(0.26, 0.012, 6, 24, Math.PI);
const longHairGeo = new THREE.CapsuleGeometry(0.2, 0.22, 4, 12);
const bunGeo = new THREE.SphereGeometry(0.12, 14, 10);
const curlGeo = new THREE.SphereGeometry(0.075, 10, 8);
const browGeo = new THREE.BoxGeometry(0.1, 0.03, 0.03);
const headsetGeo = new THREE.BoxGeometry(0.42, 0.16, 0.14);
const headStrapGeo = new THREE.TorusGeometry(0.305, 0.022, 6, 28);
const jacketGeo = new THREE.CapsuleGeometry(0.232, 0.22, 6, 16);
const scarfGeo = new THREE.TorusGeometry(0.16, 0.065, 8, 20);
const scarfTailGeo = new THREE.BoxGeometry(0.1, 0.28, 0.04);
const deviceGeo = new THREE.BoxGeometry(0.1, 0.07, 0.1);
const gpuGeo = new THREE.BoxGeometry(0.26, 0.04, 0.14);
const canGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.13, 14);
const sinkGeo = new THREE.BoxGeometry(0.44, 0.15, 0.32);
const basinGeo = new THREE.BoxGeometry(0.34, 0.02, 0.22);
const tapGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8);
const cardboardGeo = new THREE.BoxGeometry(0.36, 0.26, 0.28);
const tapeGeo = new THREE.BoxGeometry(0.37, 0.27, 0.06);
const shadowGeo = new THREE.CircleGeometry(0.34, 24).rotateX(-Math.PI / 2);
const hitGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.7, 10).translate(0, 0.85, 0);
const iceGeo = new THREE.BoxGeometry(0.95, 1.8, 0.85).translate(0, 0.9, 0);
const iceEdges = new THREE.EdgesGeometry(iceGeo);

const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b1630, transparent: true, opacity: 0.28, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const darkMat = new THREE.MeshBasicMaterial({ color: 0x1d1830 });
const blushMat = new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.55 });
const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.1, depthWrite: false });
const iceLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

export const OUTLINE = 0x2a2142, HIGHLIGHT = 0x5fe0ff;

/** Random everyday look. Some normals share single items with CEOs (phone, hoodie, vest, black shirt) as decoys. */
export function randomLook() {
  const [shirt] = pick(SHIRTS);
  const look = {
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(['short', 'short', 'long', 'bun', 'bald']),
    shirt, pants: pick(PANTS), outfit: null,
  };
  if (chance(0.12)) look.outfit = 'hoodie';
  else if (chance(0.08)) { look.outfit = 'vest'; look.vest = pick(ACCENTS)[0]; }
  if (chance(0.3)) { look.hat = pick(['beanie', 'cap']); look.hatColor = pick(ACCENTS)[0]; }
  if (chance(0.3)) look.glasses = chance(0.6) ? 'round' : 'sun';
  if (chance(0.3)) { look.bag = pick(ACCENTS)[0]; }
  if (chance(0.25)) look.phone = true;
  return look;
}
export const ceoLook = (type) => ({ ...type.look, info: type.info, name: type.name });
export const assistantLook = () => ({ skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'short', pants: '#1c1c22', shirt: '#26262e', outfit: 'assistant', glasses: 'sun', earbuds: true });

/** One-line description for the hover card. */
export function describe(look) {
  if (look.info) return look.info;
  const bits = [];
  const shirtName = colorName(look.shirt);
  if (look.outfit === 'turtleneck') bits.push('Black turtleneck');
  else if (look.outfit === 'suit') bits.push('Sharp suit, red tie');
  else if (look.outfit === 'assistant') bits.push('Dark suit, earpiece');
  else if (look.outfit === 'hoodie') bits.push(`${shirtName || 'Grey'} hoodie`.trim());
  else if (look.outfit === 'vest') bits.push(`Fleece vest over a ${(shirtName || 'light').toLowerCase()} shirt`);
  else bits.push(`${shirtName} shirt`);
  if (look.lanyard) bits.push('conference lanyard');
  if (look.hat) bits.push(look.hat === 'cap' ? 'ball cap' : 'beanie');
  if (look.glasses === 'round') bits.push('round glasses');
  if (look.glasses === 'sun' && look.outfit !== 'assistant') bits.push('sunglasses');
  if (look.bag) bits.push(`${colorName(look.bag, ACCENTS)} tote bag`);
  if (look.phone) bits.push('phone in hand');
  if (look.earbuds && look.outfit !== 'assistant') bits.push('earbuds in');
  return bits.join(', ');
}

export function makePerson(look) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mats = [];
  const outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
  const toon = (color) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }); mats.push(m); return m; };
  const part = (geo, mat, parent, [x, y, z] = [0, 0, 0], outline = 1.07) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m);
    if (outline) { const o = new THREE.Mesh(geo, outlineMat); o.scale.setScalar(outline); m.add(o); }
    return m;
  };

  const skin = toon(look.skin), shirt = toon(look.shirt), pants = toon(look.pants), hair = toon(look.hair);

  // legs + torso + arms
  const legL = part(legGeo, pants, body, [-0.1, 0.4, 0], 1.12), legR = part(legGeo, pants, body, [0.1, 0.4, 0], 1.12);
  part(torsoGeo, shirt, body, [0, 0.66, 0]);
  const armL = part(armGeo, shirt, body, [-0.27, 0.9, 0], 1.14), armR = part(armGeo, shirt, body, [0.27, 0.9, 0], 1.14);
  armL.rotation.z = -0.12; armR.rotation.z = 0.12;
  part(new THREE.SphereGeometry(0.065, 10, 8), skin, armL, [0, -0.38, 0], 0);
  const handR = part(new THREE.SphereGeometry(0.065, 10, 8), skin, armR, [0, -0.38, 0], 0);

  // head
  const head = new THREE.Group(); head.position.set(0, 1.26, 0); body.add(head);
  part(headGeo, skin, head, [0, 0, 0], 1.045);
  for (const x of [-0.1, 0.1]) {
    part(eyeGeo, darkMat, head, [x, 0.0, 0.275], 0).scale.setScalar(look.bigEyes ? 1.5 : 1);
    if (look.brows) part(browGeo, toon(look.brows), head, [x, 0.15, 0.27], 0).scale.set(1.4, 2, 1);
    const b = part(blushGeo, blushMat, head, [x * 1.7, -0.08, 0.255], 0); b.rotation.y = x * 2.2;
  }
  if (look.hairStyle !== 'bald' || look.hat) {
    if (!look.hat || look.hat === 'cap') {
      const h = part(hairGeo, hair, head, [0, 0.01, -0.01], 0);
      h.rotation.x = { receding: -0.8, swept: -0.3, puff: -0.55 }[look.hairStyle] ?? -0.38;
      if (look.hairStyle === 'swept') h.scale.set(1.04, 1.12, 1.06);
      if (look.hairStyle === 'puff') { h.scale.set(1.3, 1.25, 1.3); h.position.set(0, 0.04, -0.06); }
    }
    if (look.hairStyle === 'curly' || look.hairStyle === 'puff') {   // bumpy curls on top
      const r = look.hairStyle === 'puff' ? 0.4 : 0.3, big = look.hairStyle === 'puff' ? 1.6 : 1;
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2, tilt = 0.55 + (k % 3) * 0.2;
        const c = part(curlGeo, hair, head, [Math.cos(a) * Math.sin(tilt) * r, Math.cos(tilt) * r + 0.02, Math.sin(a) * Math.sin(tilt) * r - 0.06], 0);
        c.scale.setScalar(big);
      }
    }
    if (look.hairStyle === 'long') part(longHairGeo, hair, head, [0, -0.2, -0.16], 1.04);
    if (look.hairStyle === 'bun' && !look.hat) part(bunGeo, hair, head, [0, 0.27, -0.18], 1.06);
  }
  if (look.hat === 'beanie') { const b = part(beanieGeo, toon(look.hatColor), head, [0, 0.02, 0], 1.04); b.rotation.x = -0.2; part(bunGeo, toon('#ffffff'), head, [0, 0.36, -0.06], 0).scale.setScalar(0.6); }
  if (look.hat === 'cap') { const c = toon(look.hatColor); const cap = part(beanieGeo, c, head, [0, 0.03, 0], 1.04); cap.rotation.x = -0.15; part(brimGeo, c, head, [0, 0.12, 0.2], 1.08); }
  if (look.glasses === 'round') {
    for (const x of [-0.1, 0.1]) part(lensGeo, darkMat, head, [x, 0.0, 0.29], 0);
    part(barGeo, darkMat, head, [0, 0.0, 0.3], 0).scale.x = 0.5;
  }
  if (look.glasses === 'sun') {
    for (const x of [-0.1, 0.1]) part(shadeGeo, darkMat, head, [x, 0.0, 0.29], 0);
    part(barGeo, darkMat, head, [0, 0.01, 0.3], 0);
  }
  if (look.earbuds) for (const x of [-0.3, 0.3]) part(budGeo, toon('#ffffff'), head, [x, -0.02, 0.03], 0);
  if (look.headset) {
    part(headsetGeo, toon('#ececf2'), head, [0, 0.02, 0.24]);
    part(new THREE.BoxGeometry(0.36, 0.11, 0.02), darkMat, head, [0, 0.02, 0.315], 0);
    part(headStrapGeo, darkMat, head, [0, 0.03, 0], 0).rotation.x = Math.PI / 2;
  }

  // outfits
  if (look.outfit === 'turtleneck') part(neckGeo, shirt, body, [0, 0.99, 0]);
  if (look.outfit === 'suit' || look.outfit === 'assistant' || look.outfit === 'sweater') {
    part(collarGeo, toon(look.collar || '#ffffff'), body, [0, 0.9, 0.17], 0).rotation.x = -0.35;
    const tie = look.tie === undefined ? (look.outfit === 'suit' ? '#d93a3a' : null) : look.tie;
    if (tie) part(tieGeo, toon(tie), body, [0, 0.8, 0.205], 0).rotation.x = -0.12;
  }
  if (look.jacket) {
    const jm = toon(look.jacket);
    part(jacketGeo, jm, body, [0, 0.67, 0]);
    armL.material = jm; armR.material = jm;
  }
  if (look.scarf) {
    const sm = toon(look.scarf);
    part(scarfGeo, sm, body, [0, 0.98, 0.01]).rotation.x = Math.PI / 2;
    part(scarfTailGeo, sm, body, [0.09, 0.8, 0.21], 0).rotation.z = 0.12;
  }
  if (look.outfit === 'hoodie') { const h = part(hoodGeo, shirt, body, [0, 1.02, -0.13]); h.rotation.x = -1.1; }
  if (look.outfit === 'vest') part(vestGeo, toon(look.vest), body, [0, 0.7, 0]);
  if (look.lanyard) {
    const c = part(cordGeo, toon('#e84a7a'), body, [0, 0.86, 0.06], 0); c.rotation.x = -1.25;
    part(badgeGeo, toon('#ffffff'), body, [0, 0.7, 0.215], 0);
  }
  if (look.bag) {
    const bm = toon(look.bag);
    part(bagGeo, bm, body, [-0.33, 0.52, 0.02]);
    const s = part(strapGeo, bm, body, [-0.2, 0.67, 0.02], 0); s.rotation.z = 0.5;
  }
  let phone = null;
  if (look.phone) { phone = part(phoneGeo, darkMat, handR, [0, 0, 0.05], 0); phone.rotation.x = -0.4; }
  // one-hand props (held up like a phone)
  if (look.carry === 'device') phone = part(deviceGeo, toon('#ffffff'), handR, [0, 0, 0.06]);
  if (look.carry === 'gpu') { phone = part(gpuGeo, toon('#76b900'), handR, [0, 0, 0.07]); part(new THREE.BoxGeometry(0.2, 0.045, 0.1), darkMat, phone, [0, 0.005, 0], 0); }
  if (look.carry === 'soda') phone = part(canGeo, toon('#c8202c'), handR, [0, 0, 0.05]);
  // two-hand props (held in front)
  let twoHand = false;
  if (look.carry === 'sink') {
    twoHand = true;
    const sink = part(sinkGeo, toon('#f4f6f8'), body, [0, 0.6, 0.36]);
    part(basinGeo, toon('#b9c3cc'), sink, [0, 0.07, 0], 0);
    part(tapGeo, toon('#c0c6cc'), sink, [0, 0.13, -0.12], 0);
  }
  if (look.carry === 'box') {
    twoHand = true;
    const box = part(cardboardGeo, toon('#c8955a'), body, [0, 0.62, 0.36]);
    part(tapeGeo, toon('#e3c08f'), box, [0, 0, 0], 0);
  }

  // ground shadow + click target
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01; shadow.renderOrder = -1; root.add(shadow);
  const hitbox = new THREE.Mesh(hitGeo, hitMat); root.add(hitbox);

  root.userData = { rig: { body, head, legL, legR, armL, armR }, mats, outlineMat, hitbox, look, handProp: !!phone, twoHand };
  return root;
}

/**
 * Pose for one frame.
 * phase: walk-cycle phase · amp: 0 (standing) … 1 (full stride)
 * mode: 'walk' | 'phone' (head down, as if reading) | 'pitch' (both arms waving)
 */
export function pose(person, phase, amp, mode, t) {
  const { body, head, legL, legR, armL, armR } = person.userData.rig;
  const s = Math.sin(phase) * amp;
  legL.rotation.x = s * 0.7; legR.rotation.x = -s * 0.7;
  body.position.y = Math.abs(Math.cos(phase)) * 0.045 * amp;
  body.rotation.z = Math.sin(phase) * 0.04 * amp;
  head.rotation.x = 0;
  armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
  armL.rotation.z = -0.12; armR.rotation.z = 0.12;
  if (person.userData.handProp && mode !== 'pitch') { armR.rotation.x = -1.25; armR.rotation.z = -0.25; }
  if (mode === 'phone') head.rotation.x = 0.35;
  if (person.userData.twoHand && mode !== 'pitch') {
    armL.rotation.x = armR.rotation.x = -1.1 + s * 0.08;
    armL.rotation.z = 0.3; armR.rotation.z = -0.3;
  }
  if (mode === 'pitch') {
    armL.rotation.x = -1.6 + Math.sin(t * 9) * 0.5; armL.rotation.z = -0.5;
    armR.rotation.x = -1.3 + Math.sin(t * 9 + 1.5) * 0.5; armR.rotation.z = 0.5;
    body.position.y = Math.abs(Math.sin(t * 9)) * 0.07;
    head.rotation.x = Math.sin(t * 4.5) * 0.12;
  }
}

/** Encase a person in ice: tint them icy and add a translucent block. Returns the block (scale it in). */
export function encase(person) {
  const ice = new THREE.Color('#cdeeff');
  for (const m of person.userData.mats) m.color.lerp(ice, 0.55);
  person.userData.outlineMat.color.set('#3c7fb0');
  const block = new THREE.Mesh(iceGeo, iceMat);
  block.add(new THREE.LineSegments(iceEdges, iceLineMat));
  block.renderOrder = 2;
  person.add(block);
  return block;
}
