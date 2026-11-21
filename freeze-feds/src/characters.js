import * as THREE from 'three';
import { buildMii, setBone, setChildBone, armRot, frameOn, outlineMaterial } from './mii.js';

// Mii-style people built from the GLB parts in public/models (see src/mii.js): a skinned body, one of
// 8 head shapes with a drawn-on face, one of 68 hairstyles or a hat, toon shading with an outline.
// Looks, accessories and props are added on top. crowd.js only relies on the returned Group,
// `userData.rig` (posed by pose()), `userData.mats` (tinted by encase()) and `userData.hitbox`.
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

// Mii parts per CEO: body, head shape, hairstyle (public/models/character-hair) and face
const CEO_MII = {
  holmes: { gender: 'female', head: 'head-02', hairModel: 'hair-61', face: { eyes: 'wide', mouth: 'flat' } },
  zuckerberg: { head: 'head-05', hairModel: 'hair-13', face: { eyes: 'oval', mouth: 'flat' } },
  huang: { head: 'head-04', hairModel: 'hair-11', face: { eyes: 'happy', mouth: 'open' } },
  musk: { head: 'head-08', hairModel: 'hair-04', face: { eyes: 'oval', mouth: 'smirk' } },
  thiel: { head: 'head-03', hairModel: 'hair-32', face: { eyes: 'dot', mouth: 'flat' } },
  karp: { head: 'head-06', hairModel: 'hair-30', face: { eyes: 'oval', mouth: 'open' } },
  gates: { head: 'head-01', hairModel: 'hair-35', face: { eyes: 'dot', mouth: 'smile' } },
  bezos: { head: 'head-07', hairModel: null, face: { eyes: 'oval', mouth: 'open' } },
  dimon: { head: 'head-03', hairModel: 'hair-06', face: { eyes: 'dot', mouth: 'smirk', browTilt: -1 } },
  buffett: { head: 'head-01', hairModel: 'hair-29', face: { eyes: 'happy', mouth: 'smile', bushy: true } },
};

// hairstyles for everyone else, by style
const HAIR_STYLES = {
  short: ['hair-01', 'hair-02', 'hair-04', 'hair-05', 'hair-12', 'hair-15', 'hair-16', 'hair-17', 'hair-18', 'hair-21', 'hair-24', 'hair-28', 'hair-31', 'hair-10', 'hair-26', 'hair-39'],
  long: ['hair-34', 'hair-37', 'hair-42', 'hair-44', 'hair-45', 'hair-46', 'hair-49', 'hair-50', 'hair-53', 'hair-56', 'hair-58', 'hair-66'],
  bun: ['hair-61', 'hair-62', 'hair-59', 'hair-40', 'hair-60', 'hair-63'],
};
const FACE_EYES = ['oval', 'oval', 'dot', 'lash', 'happy'], FACE_MOUTHS = ['smile', 'smile', 'open', 'flat', 'smirk'];
const randomFace = () => ({ eyes: pick(FACE_EYES), mouth: pick(FACE_MOUTHS), browTilt: pick([-1, 0, 0, 1]), blush: chance(0.3) });
const HEADS = ['head-01', 'head-02', 'head-03', 'head-04', 'head-05', 'head-06', 'head-07', 'head-08'];

// ---- prop / accessory geometry (metres, in the character frame: x right, y up, z forward) ----
const lensGeo = new THREE.TorusGeometry(0.065, 0.013, 6, 18);
const shadeGeo = new THREE.BoxGeometry(0.13, 0.075, 0.03);
const barGeo = new THREE.BoxGeometry(0.08, 0.016, 0.016);
const phoneGeo = new THREE.BoxGeometry(0.085, 0.15, 0.018);
const budGeo = new THREE.SphereGeometry(0.035, 8, 6);
const neckGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.1, 18);
const hoodGeo = new THREE.TorusGeometry(0.12, 0.055, 8, 20);
const cordGeo = new THREE.TorusGeometry(0.11, 0.009, 6, 24);
const badgeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.012);
const tieGeo = new THREE.BoxGeometry(0.045, 0.2, 0.02);
const collarGeo = new THREE.BoxGeometry(0.11, 0.09, 0.02);
const bagGeo = new THREE.BoxGeometry(0.24, 0.27, 0.07);
const strapGeo = new THREE.TorusGeometry(0.22, 0.01, 6, 24, Math.PI);
const headsetGeo = new THREE.BoxGeometry(0.4, 0.15, 0.14);
const headStrapGeo = new THREE.TorusGeometry(0.3, 0.022, 6, 28);
const scarfGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 20);
const scarfTailGeo = new THREE.BoxGeometry(0.08, 0.24, 0.035);
const deviceGeo = new THREE.BoxGeometry(0.1, 0.07, 0.1);
const gpuGeo = new THREE.BoxGeometry(0.26, 0.04, 0.14);
const canGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.13, 14);
const sinkGeo = new THREE.BoxGeometry(0.44, 0.15, 0.32);
const basinGeo = new THREE.BoxGeometry(0.34, 0.02, 0.22);
const tapGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8);
const cardboardGeo = new THREE.BoxGeometry(0.36, 0.26, 0.28);
const tapeGeo = new THREE.BoxGeometry(0.37, 0.27, 0.06);
const shadowGeo = new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2);
const hitGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.65, 10).translate(0, 0.83, 0);
const iceGeo = new THREE.BoxGeometry(0.95, 1.8, 0.85).translate(0, 0.9, 0);
const iceEdges = new THREE.EdgesGeometry(iceGeo);

const MII_SCALE = 0.9;            // the Mii model is ~1.76 m to the top of the head; this makes ~1.6

const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b1630, transparent: true, opacity: 0.28, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const darkMat = new THREE.MeshBasicMaterial({ color: 0x1d1830 });
const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.1, depthWrite: false });
const iceLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

export const OUTLINE = 0x2a2142, HIGHLIGHT = 0x5fe0ff;

/** Random everyday look. Some normals share single items with CEOs (phone, hoodie, vest, black shirt) as decoys. */
export function randomLook() {
  const [shirt] = pick(SHIRTS);
  const look = {
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(['short', 'short', 'long', 'bun', 'bald']),
    shirt, pants: pick(PANTS), outfit: null, head: pick(HEADS), face: randomFace(),
  };
  look.gender = look.hairStyle === 'long' || look.hairStyle === 'bun' ? (chance(0.8) ? 'female' : 'male') : (chance(0.15) ? 'female' : 'male');
  look.hairModel = look.hairStyle === 'bald' ? null : pick(HAIR_STYLES[look.hairStyle]);
  if (chance(0.12)) look.outfit = 'hoodie';
  else if (chance(0.08)) { look.outfit = 'vest'; look.vest = pick(ACCENTS)[0]; }
  if (chance(0.3)) { look.hat = pick(['beanie', 'cap']); look.hatColor = pick(ACCENTS)[0]; }
  if (chance(0.3)) look.glasses = chance(0.6) ? 'round' : 'sun';
  if (chance(0.3)) { look.bag = pick(ACCENTS)[0]; }
  if (chance(0.25)) look.phone = true;
  return look;
}
export const ceoLook = (type) => ({ ...type.look, ...CEO_MII[type.id], info: type.info, name: type.name });
export const assistantLook = () => ({ skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'short', hairModel: pick(HAIR_STYLES.short), head: pick(HEADS),
  face: { eyes: 'dot', mouth: 'flat' }, pants: '#1c1c22', shirt: '#26262e', outfit: 'assistant', glasses: 'sun', earbuds: true });

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
  const outlineMat = outlineMaterial(OUTLINE, 1.4);                  // body geometry is in cm
  const outlineHeadMat = outlineMaterial(OUTLINE, 0.012);            // head geometry is in metres
  const outlineSolid = new THREE.MeshBasicMaterial({ side: THREE.BackSide });  // scaled-up hulls for props
  outlineHeadMat.color = outlineSolid.color = outlineMat.color;      // one colour for all (highlight / ice)
  const toon = (color) => { const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient }); mats.push(m); return m; };
  const part = (geo, mat, parent, [x, y, z] = [0, 0, 0], outline = 1.07) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m);
    if (outline) { const o = new THREE.Mesh(geo, outlineSolid); o.scale.setScalar(outline); m.add(o); }
    return m;
  };

  // outfit colours per body part
  const suitish = look.outfit === 'suit' || look.outfit === 'assistant';
  const colors = {
    skin: look.skin, hair: look.hair,
    torso: look.outfit === 'vest' ? look.vest : look.jacket || look.shirt,
    sleeve: look.jacket || look.shirt,
    hand: look.skin, legs: look.pants,
    shoes: suitish ? '#141418' : '#2c2a30',
  };
  const face = { eyes: 'oval', mouth: 'smile', browTilt: 0, ...look.face, brow: look.brows || (look.hairStyle === 'bald' ? '#5a4030' : look.hair) };
  if (look.bigEyes) face.eyes = 'wide';
  const mii = buildMii({
    gender: look.gender || 'male', head: look.head, hair: look.hairModel, hat: look.hat, hatColor: look.hatColor,
    face, toon, outlineMat, outlineHeadMat, colors,
  });
  mii.model.scale.setScalar(MII_SCALE);
  body.add(mii.model);
  const { headFrame: hf, faceFront: fz, eyeY: ey, handR, handL } = mii;
  const chest = frameOn(mii.bones.chest);        // torso frame, origin at the chest bone (0.7 m up the body)

  // head accessories (head frame: origin at the neck, face at z = fz, eyes at y = ey)
  if (look.glasses === 'round') {
    for (const x of [-0.092, 0.092]) part(lensGeo, darkMat, hf, [x, ey, fz + 0.012], 0);
    part(barGeo, darkMat, hf, [0, ey, fz + 0.02], 0).scale.x = 0.4;
  }
  if (look.glasses === 'sun') {
    for (const x of [-0.092, 0.092]) part(shadeGeo, darkMat, hf, [x, ey, fz + 0.012], 0);
    part(barGeo, darkMat, hf, [0, ey + 0.01, fz + 0.02], 0);
  }
  if (look.earbuds) for (const x of [-0.27, 0.27]) part(budGeo, toon('#ffffff'), hf, [x, ey - 0.03, 0.03], 0);
  if (look.headset) {
    part(headsetGeo, toon('#ececf2'), hf, [0, ey + 0.01, fz - 0.03]);
    part(new THREE.BoxGeometry(0.34, 0.1, 0.02), darkMat, hf, [0, ey + 0.01, fz + 0.045], 0);
    part(headStrapGeo, darkMat, hf, [0, ey + 0.02, 0.0], 0).rotation.x = Math.PI / 2;
  }

  // torso accessories (chest frame: neck at y ≈ 0.39, shoulders ≈ 0.33, chest front at z ≈ 0.12)
  if (look.outfit === 'turtleneck') part(neckGeo, mii.parts.torso, chest, [0, 0.4, 0.0], 1.1);
  if (suitish || look.outfit === 'sweater') {
    part(collarGeo, toon(look.collar || '#ffffff'), chest, [0, 0.33, 0.1], 0).rotation.x = -0.35;
    const tie = look.tie === undefined ? (look.outfit === 'suit' ? '#d93a3a' : null) : look.tie;
    if (tie) part(tieGeo, toon(tie), chest, [0, 0.22, 0.13], 0).rotation.x = -0.15;
  }
  if (look.scarf) {
    const sm = toon(look.scarf);
    part(scarfGeo, sm, chest, [0, 0.39, 0.0]).rotation.x = Math.PI / 2;
    part(scarfTailGeo, sm, chest, [0.06, 0.24, 0.13], 0).rotation.z = 0.12;
  }
  if (look.outfit === 'hoodie') { const h = part(hoodGeo, mii.parts.torso, chest, [0, 0.36, -0.1]); h.rotation.x = -1.1; }
  if (look.lanyard) {
    const c = part(cordGeo, toon('#e84a7a'), chest, [0, 0.33, 0.04], 0); c.rotation.x = -1.25;
    part(badgeGeo, toon('#ffffff'), chest, [0, 0.2, 0.14], 0);
  }
  if (look.bag) {
    const bm = toon(look.bag);
    part(bagGeo, bm, chest, [-0.26, -0.12, 0.0]);
    const s = part(strapGeo, bm, chest, [-0.12, 0.1, 0.0], 0); s.rotation.z = 0.5;
  }

  // props in the right hand (hand frame: arm along −y, z forward, origin at the wrist)
  let phone = null;
  if (look.phone) { phone = part(phoneGeo, darkMat, handR, [0, -0.06, 0.06], 0); phone.rotation.x = -0.4; }
  if (look.carry === 'device') phone = part(deviceGeo, toon('#ffffff'), handR, [0, -0.06, 0.08]);
  if (look.carry === 'gpu') { phone = part(gpuGeo, toon('#76b900'), handR, [0, -0.06, 0.09]); part(new THREE.BoxGeometry(0.2, 0.045, 0.1), darkMat, phone, [0, 0.005, 0], 0); }
  if (look.carry === 'soda') phone = part(canGeo, toon('#c8202c'), handR, [0, -0.06, 0.07]);
  // two-hand props, held in front of the body
  let twoHand = false;
  if (look.carry === 'sink') {
    twoHand = true;
    const sink = part(sinkGeo, toon('#f4f6f8'), body, [0, 0.6, 0.36]);
    part(basinGeo, toon('#b9c3cc'), sink, [0, 0.07, 0], 0);
    part(tapGeo, toon('#c0c6cc'), sink, [0, 0.13, -0.12], 0);
  }
  if (look.carry === 'box') {
    twoHand = true;
    const box = part(cardboardGeo, toon('#c8955a'), body, [0, 0.62, 0.34]);
    part(tapeGeo, toon('#e3c08f'), box, [0, 0, 0], 0);
  }

  // ground shadow + click target
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01; shadow.renderOrder = -1; root.add(shadow);
  const hitbox = new THREE.Mesh(hitGeo, hitMat); root.add(hitbox);

  root.userData = { rig: { body, ...mii.bones }, mats, outlineMat, hitbox, look, handProp: !!phone, twoHand };
  return root;
}

const qUpL = new THREE.Quaternion(), qUpR = new THREE.Quaternion(), qLoL = new THREE.Quaternion(), qLoR = new THREE.Quaternion();
/**
 * Pose for one frame.
 * phase: walk-cycle phase · amp: 0 (standing) … 1 (full stride)
 * mode: 'walk' | 'phone' (head down, as if reading) | 'pitch' (both arms waving)
 * Arm angles are for an arm hanging straight down: x swings it forward (−) / back (+), z lifts it
 * outward (− on the left arm, + on the right). Each arm has an upper (u) and a forearm (f) angle.
 */
export function pose(person, phase, amp, mode, t) {
  const { body, head, legL, legR, armL, armR, foreL, foreR } = person.userData.rig;
  const s = Math.sin(phase) * amp;
  const L = { ux: -s * 0.7, uz: -0.1, fx: -s * 0.7 - 0.15, fz: -0.1 };
  const R = { ux: s * 0.7, uz: 0.1, fx: s * 0.7 - 0.15, fz: 0.1 };
  let hx = 0;
  body.position.y = Math.abs(Math.cos(phase)) * 0.04 * amp;
  body.rotation.z = Math.sin(phase) * 0.04 * amp;
  if (person.userData.handProp && mode !== 'pitch') Object.assign(R, { ux: -0.45, uz: 0.05, fx: -1.45, fz: -0.45 });   // phone up in front of the chest
  if (mode === 'phone') hx = 0.35;
  if (person.userData.twoHand && mode !== 'pitch') {                                                                   // carrying something big
    const b = s * 0.06;
    Object.assign(L, { ux: -0.35 + b, uz: -0.12, fx: -1.3 + b, fz: -0.1 });
    Object.assign(R, { ux: -0.35 + b, uz: 0.12, fx: -1.3 + b, fz: 0.1 });
  }
  if (mode === 'pitch') {
    const w = Math.sin(t * 9) * 0.5, w2 = Math.sin(t * 9 + 1.5) * 0.5;
    Object.assign(L, { ux: -1.1 + w, uz: -0.45, fx: -2.0 + w, fz: -0.2 });
    Object.assign(R, { ux: -0.9 + w2, uz: 0.45, fx: -1.8 + w2, fz: 0.2 });
    body.position.y = Math.abs(Math.sin(t * 9)) * 0.07;
    hx = Math.sin(t * 4.5) * 0.12;
  }
  setBone(legL, s * 0.6, 0, 0); setBone(legR, -s * 0.6, 0, 0);
  armRot(-1, L.ux, L.uz, qUpL); armRot(-1, L.fx, L.fz, qLoL);
  armRot(1, R.ux, R.uz, qUpR); armRot(1, R.fx, R.fz, qLoR);
  setBone(armL, 0, 0, 0, qUpL); setChildBone(foreL, qUpL, qLoL);
  setBone(armR, 0, 0, 0, qUpR); setChildBone(foreR, qUpR, qLoR);
  setBone(head, hx, 0, 0);
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
