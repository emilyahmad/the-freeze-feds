import * as THREE from 'three';
import { buildMii, setBone, setChildBone, armRot, frameOn, outlineMaterial, EYE_COLORS, FACE_SCALE, faces } from './mii.js';

// Mii-style people built from the GLB parts in public/models (see src/mii.js): a skinned body, one of
// 8 head shapes with ears and a drawn-on Mii face, one of 68 hairstyles or a hat. Soft glossy shading
// like the Wii Miis (no outline; the outline only appears as the hover highlight / when frozen).
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
  { id: 'holmes', name: 'Elizabeth Holmes', behavior: 'pace', info: 'Black turtleneck, long blonde hair pulled back, pale, wide unblinking eyes, tiny blood-test gadget',
    look: { skin: '#f9e4d6', hair: '#dcc48e', hairStyle: 'long', outfit: 'turtleneck', shirt: '#17171b', pants: '#17171b', bigEyes: true, carry: 'device' } },
  { id: 'zuckerberg', name: 'Mark Zuckerberg', behavior: 'speed', info: 'Plain tee, short brown hair, youthful face, VR headset on',
    look: { skin: '#f3d3bc', hair: '#5a3b26', hairStyle: 'short', shirt: '#4a5d93', pants: '#2f3e5c', headset: true } },
  { id: 'huang', name: 'Jensen Huang', behavior: 'pitch', info: 'Black leather jacket, short grey-black hair, glasses, waving a graphics chip',
    look: { skin: '#e6bf98', hair: '#5f5f66', hairStyle: 'swept', shirt: '#141418', jacket: '#141418', pants: '#141418', glasses: 'square', glassesColor: '#2a2a30', carry: 'gpu' } },
  { id: 'thiel', name: 'Peter Thiel', behavior: 'loiter', info: 'Short brown-grey hair, round face, charcoal suit and tie',
    look: { skin: '#f3d6c2', hair: '#6e6258', hairStyle: 'short', outfit: 'suit', shirt: '#33363e', pants: '#33363e', collar: '#ffffff', tie: '#2c4a9a' } },
  { id: 'karp', name: 'Alex Karp', behavior: 'pitch', info: 'Balding, stubbly beard, olive military-style jacket',
    look: { skin: '#ecc9a8', hair: '#7a7268', hairStyle: 'receding', shirt: '#2a2a2e', jacket: '#59613f', pants: '#3a3d30' } },
  { id: 'gates', name: 'Bill Gates', behavior: 'pace', info: 'Grey-white hair, glasses, navy sweater over a collared shirt',
    look: { skin: '#f3d0bc', hair: '#c4c0b8', hairStyle: 'short', outfit: 'sweater', shirt: '#242b44', pants: '#6b5b45', collar: '#d6e4f2', glasses: 'square', glassesColor: '#2c2c34' } },
  { id: 'bezos', name: 'Jeff Bezos', behavior: 'lead', info: 'Shiny bald head, bushy eyebrows, trimmed goatee, fitted grey jacket, carrying a cardboard box',
    look: { skin: '#efc6a6', hair: '#3a2a20', hairStyle: 'bald', brows: '#3a2a20', shirt: '#a9c8ea', jacket: '#555a63', pants: '#2f3e5c', collar: '#b4d0ee', carry: 'box' } },
  { id: 'dimon', name: 'Jamie Dimon', behavior: 'lead', info: 'Short grey hair, broad face, dark suit and tie',
    look: { skin: '#eec4a6', hair: '#c9cacf', hairStyle: 'short', outfit: 'suit', shirt: '#1e2944', pants: '#1e2944', collar: '#ffffff', tie: '#5b6d8e' } },
  { id: 'buffett', name: 'Warren Buffett', behavior: 'slow', info: 'White hair, glasses, older face, navy suit and red tie, can of soda',
    look: { skin: '#f2cdb8', hair: '#f2f2f4', hairStyle: 'short', outfit: 'suit', shirt: '#26304a', pants: '#26304a', collar: '#ffffff', tie: '#9a2b2b', glasses: 'round', glassesColor: '#6a5848', brows: '#f2f2f4', carry: 'soda' } },
];

// ---- shared geometry ----

// Mii parts per CEO: body, head shape, hairstyle (public/models/character-hair) and face
// Mii parts per boss, designed from reference photos (be-elsa/design-references/tech-people-references.png):
// head shape, hairstyle (public/models/character-hair), and face (eye shape and colour, nose, mouth, extras)
const CEO_MII = {
  holmes: { gender: 'female', head: 'head-02', hairModel: 'hair-60', face: { eyes: 'round', eyeColor: '#3f73b0', lashes: true, mouth: 'flat', lips: '#b5504a', nose: 'small', mouthW: 0.038 } },
  zuckerberg: { head: 'head-05', hairModel: 'hair-default', face: { eyes: 'mii', eyeColor: '#5d7fa8', mouth: 'flat', nose: 'small', mouthW: 0.04, blush: true } },
  huang: { head: 'head-04', hairModel: 'hair-11', face: { eyes: 'narrow', eyeColor: '#2b1d14', mouth: 'open', nose: 'mid', mouthW: 0.048 } },
  thiel: { head: 'head-06', hairModel: 'hair-31', face: { eyes: 'mii', eyeColor: '#5d86b3', mouth: 'flat', nose: 'small', mouthW: 0.04 } },
  karp: { head: 'head-03', hairModel: 'hair-32', face: { eyes: 'round', eyeColor: '#5a3a22', mouth: 'smirk', nose: 'big', beard: '#6a6258', mouthW: 0.042 } },
  gates: { head: 'head-01', hairModel: 'hair-21', face: { eyes: 'narrow', eyeColor: '#5d86b3', mouth: 'open', nose: 'mid', wrinkles: true, mouthW: 0.048 } },
  bezos: { head: 'head-07', hairModel: null, face: { eyes: 'mii', eyeColor: '#3a2a20', mouth: 'open', nose: 'big', bushy: true, browTilt: 0.3, goatee: '#4a3a2e', mouthW: 0.05 } },
  dimon: { head: 'head-04', headWidth: 1.12, hairModel: 'hair-28', face: { eyes: 'narrow', eyeColor: '#4f7fb8', mouth: 'open', nose: 'big', wrinkles: true, mouthW: 0.052 } },
  buffett: { head: 'head-01', hairModel: 'hair-29', face: { eyes: 'happy', mouth: 'smile', nose: 'big', bushy: true, wrinkles: true, mouthW: 0.044 } },
};

// hairstyles for everyone else, by style
const HAIR_STYLES = {
  short: ['hair-default', 'hair-default', 'hair-default', 'hair-01', 'hair-02', 'hair-04', 'hair-05', 'hair-12', 'hair-15', 'hair-16', 'hair-17', 'hair-18', 'hair-21', 'hair-24', 'hair-28', 'hair-31', 'hair-10', 'hair-26', 'hair-39'],
  long: ['hair-34', 'hair-37', 'hair-42', 'hair-44', 'hair-45', 'hair-46', 'hair-49', 'hair-50', 'hair-53', 'hair-56', 'hair-58', 'hair-66'],
  bun: ['hair-61', 'hair-62', 'hair-59', 'hair-40', 'hair-60', 'hair-63'],
};
const FACE_EYES = ['mii', 'mii', 'mii', 'mii', 'round', 'narrow', 'dot', 'happy'], FACE_MOUTHS = ['smile', 'smile', 'flat', 'flat', 'open', 'frown', 'smirk'];
const LIPS = ['#c4605a', '#b85a55', '#a8504c'], LIPSTICK = ['#d0384a', '#c2306a', '#b8484a'];
function randomFace(look) {
  const female = look.gender === 'female', grey = look.hair === '#9a9a9a';
  const f = {
    eyes: pick(FACE_EYES), eyeColor: pick([...EYE_COLORS, EYE_COLORS[0], EYE_COLORS[1]]), nose: pick(['small', 'mid', 'mid', 'big', 'long']),
    mouth: pick(FACE_MOUTHS), mouthW: 0.036 + Math.random() * 0.014, browTilt: pick([-0.6, 0, 0, 0, 0.5, 1]),
    lips: female && chance(0.6) ? pick(LIPSTICK) : pick(LIPS), blush: chance(female ? 0.35 : 0.12),
  };
  if (female) f.lashes = chance(0.7);
  else {
    if (chance(0.14)) f.moustache = look.hair;
    if (chance(0.12)) f.beard = look.hair; else if (chance(0.12)) f.stubble = true;
  }
  if (grey && chance(0.6)) f.wrinkles = true;
  return f;
}
const HEADS = ['head-01', 'head-02', 'head-03', 'head-04', 'head-05', 'head-06', 'head-07', 'head-08'];

// ---- prop / accessory geometry (metres, in the character frame: x right, y up, z forward) ----
// Mii glasses: big, thin frames. Lens shapes are flat rings (frames) and discs (sunglass lenses).
const lensShape = (w, h, r) => { const s = new THREE.Shape(); s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h); return s; };
const frameGeo = (w, h, r, t) => { const s = lensShape(w, h, r); s.holes.push(lensShape(w - t, h - t, Math.max(0.002, r - t))); return new THREE.ShapeGeometry(s, 12); };
const roundFrameGeo = frameGeo(0.042, 0.038, 0.037, 0.0055), squareFrameGeo = frameGeo(0.046, 0.032, 0.012, 0.006);
const sunLensGeo = new THREE.ShapeGeometry(lensShape(0.046, 0.03, 0.014), 12), sunFrameGeo = frameGeo(0.047, 0.031, 0.014, 0.005);
const barGeo = new THREE.BoxGeometry(0.05, 0.007, 0.006);
const phoneGeo = new THREE.BoxGeometry(0.085, 0.15, 0.018);
const budGeo = new THREE.SphereGeometry(0.035, 8, 6);
const neckGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.1, 18);
const cordGeo = new THREE.TorusGeometry(0.11, 0.009, 6, 24);
const badgeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.012);
const tieGeo = new THREE.BoxGeometry(0.045, 0.2, 0.02);
// open shirt collar: two pointed flaps in a V, plus a sliver of shirt showing between them
const collarFlapGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.058, 0.012); s.lineTo(0.05, 0.05); s.lineTo(0.006, 0.03); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false }); })();
const collarVGeo = (() => { const s = new THREE.Shape(); s.moveTo(-0.045, 0.045); s.lineTo(0.045, 0.045); s.lineTo(0, -0.04); s.closePath(); return new THREE.ShapeGeometry(s); })();
const headsetGeo = new THREE.BoxGeometry(0.4, 0.15, 0.14);
const headStrapGeo = new THREE.TorusGeometry(0.3, 0.022, 6, 28);
const scarfGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 20);
const scarfTailGeo = new THREE.BoxGeometry(0.08, 0.24, 0.035);
const deviceGeo = new THREE.BoxGeometry(0.1, 0.07, 0.1);
// graphics card (after design-references/gpu.jpeg): card frame x = length, y = up (the shroud's top face), z = width
const GPU_L = 0.32, GPU_W = 0.12;
const gpuGeo = {
  pcb: new THREE.BoxGeometry(GPU_L, 0.012, GPU_W),
  fingers: new THREE.BoxGeometry(0.13, 0.008, 0.022),
  shroud: new THREE.BoxGeometry(GPU_L - 0.016, 0.036, GPU_W - 0.006),
  fins: new THREE.PlaneGeometry(0.15, 0.072).rotateX(-Math.PI / 2),
  ring: new THREE.TorusGeometry(0.043, 0.0065, 8, 28).rotateX(Math.PI / 2),
  fan: new THREE.CircleGeometry(0.04, 28).rotateX(-Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.017, 0.019, 0.01, 18),
  bracket: new THREE.BoxGeometry(0.007, 0.07, GPU_W + 0.004),
  strip: new THREE.BoxGeometry(GPU_L - 0.05, 0.006, 0.003),
};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let gpuTex = null;   // built on first use (needs a document)
function gpuTextures() {
  return gpuTex ||= {
    fins: canvasTex(256, 128, (g, w, h) => {          // heatsink fins running along the card
      g.fillStyle = '#b4b9bf'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5d6268'; for (let y = 3; y < h; y += 7) g.fillRect(0, y, w, 3);
      g.strokeStyle = '#2a2a2e'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    }),
    fan: canvasTex(256, 256, (g, w) => {              // blower: dark hub well with curved blades
      const r = w / 2; g.fillStyle = '#18181c'; g.fillRect(0, 0, w, w);
      g.translate(r, r); g.fillStyle = '#4a4d54';
      for (let i = 0; i < 24; i++) {
        g.rotate(Math.PI * 2 / 24);
        g.beginPath(); g.moveTo(r * 0.4, -4); g.quadraticCurveTo(r * 0.7, -12, r * 0.98, -6); g.lineTo(r * 0.98, 4); g.quadraticCurveTo(r * 0.7, -2, r * 0.4, 4); g.fill();
      }
    }),
  };
}
const canGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.13, 14);
const cardboardGeo = new THREE.BoxGeometry(0.36, 0.26, 0.28);
const tapeGeo = new THREE.BoxGeometry(0.37, 0.27, 0.06);
const shadowGeo = new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2);
const hitGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.65, 10).translate(0, 0.83, 0);
const iceGeo = new THREE.BoxGeometry(0.95, 1.8, 0.85).translate(0, 0.9, 0);
const iceEdges = new THREE.EdgesGeometry(iceGeo);

const MII_SCALE = 0.9;            // the Mii model is ~1.76 m to the top of the head; this makes ~1.6

// soft, slightly glossy shading like the Wii Miis: skin has a gentle sheen, hair is shinier, clothes matte-ish
const SHINE = { skin: [26, 0x2a2420], hair: [70, 0x4a4a4a], cloth: [12, 0x161616] };
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1b1630, transparent: true, opacity: 0.28, depthWrite: false });
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const darkMat = new THREE.MeshBasicMaterial({ color: 0x1d1830 });
const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.4, roughness: 0.08, metalness: 0.1, depthWrite: false });
const iceLineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

export const OUTLINE = 0x2a2142, HIGHLIGHT = 0x5fe0ff;

/** Random everyday look. Some normals share single items with CEOs (phone, vest, black shirt) as decoys. */
export function randomLook() {
  const [shirt] = pick(SHIRTS);
  const look = {
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(['short', 'short', 'long', 'bun', 'bald']),
    shirt, pants: pick(PANTS), outfit: null, head: pick(HEADS),
  };
  look.gender = look.hairStyle === 'long' || look.hairStyle === 'bun' ? (chance(0.8) ? 'female' : 'male') : (chance(0.15) ? 'female' : 'male');
  look.face = randomFace(look);
  look.hairModel = look.hairStyle === 'bald' ? null : pick(HAIR_STYLES[look.hairStyle]);
  if (chance(0.08)) { look.outfit = 'vest'; look.vest = pick(ACCENTS)[0]; }
  if (chance(0.3)) { look.hat = pick(['beanie', 'cap']); look.hatColor = pick(ACCENTS)[0]; }
  if (chance(0.3)) look.glasses = pick(['round', 'square', 'square', 'sun']);
  if (chance(0.25)) look.phone = true;
  takeCrowdFace(look);                           // last, so a crowd photo's matching look wins
  return look;
}
export function ceoLook(type) {
  const look = { ...type.look, ...CEO_MII[type.id], info: type.info, name: type.name, ceoId: type.id };
  usePhoto(look, faces.boss[type.id]);
  return look;
}
export function assistantLook() {
  const look = { skin: pick(SKINS), hair: pick(HAIRS), hairStyle: 'short', hairModel: pick(HAIR_STYLES.short), head: pick(HEADS),
    face: { eyes: 'narrow', mouth: 'flat', nose: 'mid' }, pants: '#1c1c22', shirt: '#26262e', outfit: 'assistant', glasses: 'sun', earbuds: true };
  // a crowd photo face too, with the photo's hair, but they keep the dark suit, shades and earpiece
  const photo = nextCrowdFace();
  if (photo) {
    look.photo = photo;
    if (photo.skin) look.skin = photo.skin;
    if (photo.gender) look.gender = photo.gender;
    const match = CROWD_LOOKS[photo.file];
    if (match) Object.assign(look, { gender: match.gender, hairModel: match.hairModel, hair: match.hair });
    if (photo.glasses) delete look.glasses;
  }
  return look;
}

// ---- photo faces (src/mii.js loads them from design-references/tech-faces/) ----
/** Give a look a photo face: its skin is tinted to match the photo, and 3D glasses are dropped when the photo has some. */
function usePhoto(look, photo) {
  if (!photo) return;
  look.photo = photo;
  if (photo.skin) look.skin = photo.skin;
  if (photo.glasses) delete look.glasses;
  if (photo.gender) look.gender = photo.gender;
  const match = CROWD_LOOKS[photo.file];
  if (match) {                                   // a crowd photo: dress the Mii to match the person in it
    const { info, ...rest } = match;
    delete look.hat; delete look.glasses; delete look.vest; look.outfit = null;   // the photo decides hair / glasses
    Object.assign(look, rest);
    look.info = info + (look.phone ? ', phone in hand' : '');
  }
}

// What each crowd photo's Mii looks like (design-references/remaining-faces/), matched to the photo:
// gender, hair model + colour, clothes, and a smaller body for the kids. `info` is the hover-card line.
const CROWD_LOOKS = {
  rando: { gender: 'female', hairModel: 'hair-22', hair: '#c9a86a', shirt: '#7a5a9a', pants: '#3b3b46', scale: 0.8, info: 'Purple jacket, shaggy blonde hair' },
  rando1: { gender: 'male', hairModel: 'hair-21', hair: '#1c1410', jacket: '#262b38', shirt: '#e9e2d4', collar: '#e9e2d4', pants: '#2f3e5c', info: 'Navy jacket, slicked-back black hair, stubble' },
  rando2: { gender: 'female', hairModel: 'hair-49', hair: '#b39a72', shirt: '#ececee', pants: '#4a6a9a', scale: 0.85, info: 'White tee, long dirty-blonde hair' },
  rando3: { gender: 'female', hairModel: 'hair-46', hair: '#b5804c', shirt: '#e8786a', pants: '#2f3e5c', info: 'Coral top, long wavy strawberry-blonde hair' },
  rando4: { gender: 'female', hairModel: 'hair-42', hair: '#7a4122', shirt: '#e6b9b4', pants: '#3b3b3b', info: 'Pink top, shoulder-length auburn hair, hoop earrings' },
  rando5: { gender: 'male', hairModel: 'hair-12', hair: '#2a1d16', shirt: '#e2ddd2', pants: '#4a5d3a', info: 'Cream sweater, messy dark hair' },
  rando6: { gender: 'male', hairModel: 'hair-13', hair: '#4a3424', shirt: '#1f2a40', pants: '#6b5b45', info: 'Navy polo, curly brown hair, beard' },
  rando7: { gender: 'female', hairModel: 'hair-50', hair: '#46301f', shirt: '#a8c6df', pants: '#22304a', info: 'Light blue top, brown bob with bangs' },
  rando8: { gender: 'female', hairModel: 'hair-35', hair: '#8d867c', shirt: '#4069a0', pants: '#3b3b3b', info: 'Blue shirt, short grey hair, glasses' },
  rando9: { gender: 'female', hairModel: 'hair-60', hair: '#5a3a26', shirt: '#3a3338', pants: '#22304a', info: 'Dark top, brown hair pulled back, glasses' },
  rando10: { gender: 'female', hairModel: 'hair-12', hair: '#2a1d16', shirt: '#f2b8c6', pants: '#e8e2d8', scale: 0.6, info: 'Pink onesie, tufty dark hair, toddler on the loose' },
  rando11: { gender: 'female', hairModel: 'hair-42', hair: '#7a4426', shirt: '#d9d4c8', pants: '#3b3b46', info: 'Beige blouse, layered auburn hair, pearl earrings' },
  rando12: { gender: 'male', hairModel: 'hair-31', hair: '#8a8580', shirt: '#eef0f4', collar: '#eef0f4', pants: '#3a3d48', info: 'White collar, receding grey hair, grey stubble' },
  rando13: { gender: 'female', hairModel: 'hair-50', hair: '#141010', shirt: '#c89a3a', pants: '#2f3e5c', scale: 0.9, info: 'Mustard top, black bob with bangs' },
  rando14: { gender: 'male', hairModel: 'hair-21', hair: '#3a2618', shirt: '#4a5a72', pants: '#2f3e5c', info: 'Slate tee, swept brown hair, big grin' },
  rando15: { gender: 'female', hairModel: 'hair-35', hair: '#1e1814', jacket: '#d8322c', shirt: '#d8322c', pants: '#2f3442', info: 'Red jacket, short curly dark hair, pearl earrings' },
  rando16: { gender: 'female', hairModel: 'hair-42', hair: '#151012', shirt: '#e8e4dc', pants: '#3b3b46', info: 'Cream top, wavy black shoulder-length hair' },
  rando17: { gender: 'male', hairModel: 'hair-12', hair: '#1e1612', shirt: '#7a7880', pants: '#2f3e5c', info: 'Grey shirt, short dark hair' },
  rando18: { gender: 'female', hairModel: 'hair-60', hair: '#5a3a24', shirt: '#d9a8a8', pants: '#3b3b46', info: 'Dusty-pink top, brown hair pulled back' },
  rando19: { gender: 'male', hairModel: 'hair-22', hair: '#7a7064', shirt: '#e4e2dc', collar: '#e4e2dc', pants: '#4a4a52', info: 'White polo, shaggy greying hair' },
  rando20: { gender: 'female', hairModel: 'hair-46', hair: '#3a2a22', shirt: '#7a2e3a', pants: '#22304a', info: 'Burgundy top, long dark hair, big hoop earrings' },
  rando21: { gender: 'male', hairModel: 'hair-21', hair: '#2a1c14', shirt: '#1e1e24', pants: '#3b4a66', info: 'Black tee, short dark hair, megawatt smile' },
  rando22: { gender: 'male', hat: 'beanie', hatColor: '#1c1c22', hair: '#1c1410', shirt: '#2a2a30', pants: '#3a3a40', info: 'Black beanie, full dark beard' },
  rando23: { gender: 'male', hairModel: 'hair-21', hair: '#2a2420', jacket: '#4a4e56', shirt: '#5a6a80', collar: '#5a6a80', pants: '#2f3442', info: 'Charcoal jacket, swept-back dark hair' },
};
// the crowd draws photos from a shuffled deck (no repeats in a round); once it runs out, people keep Mii faces
let faceDeck = [];
export function resetFaceDeck() {
  faceDeck = [...faces.crowd];
  for (let i = faceDeck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [faceDeck[i], faceDeck[j]] = [faceDeck[j], faceDeck[i]]; }
}
// every non-boss gets a photo: if the crowd ever outnumbers the photos, the deck is reshuffled and faces repeat
// (add more pictures to design-references/remaining-faces/ to avoid that)
function nextCrowdFace() {
  if (!faceDeck.length && faces.crowd.length) resetFaceDeck();
  return faceDeck.pop();
}
function takeCrowdFace(look) { usePhoto(look, nextCrowdFace()); }

/** One-line description for the hover card. */
export function describe(look) {
  if (look.info) return look.info;
  const bits = [];
  const shirtName = colorName(look.shirt);
  if (look.outfit === 'turtleneck') bits.push('Black turtleneck');
  else if (look.outfit === 'suit') bits.push('Sharp suit, red tie');
  else if (look.outfit === 'assistant') bits.push('Dark suit, earpiece');
  else if (look.outfit === 'vest') bits.push(`Fleece vest over a ${(shirtName || 'light').toLowerCase()} shirt`);
  else bits.push(`${shirtName} shirt`);
  if (look.lanyard) bits.push('conference lanyard');
  if (look.hat) bits.push(look.hat === 'cap' ? 'ball cap' : 'beanie');
  if (look.glasses === 'round') bits.push('round glasses');
  if (look.glasses === 'square') bits.push('glasses');
  if (look.glasses === 'sun' && look.outfit !== 'assistant') bits.push('sunglasses');
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
  const outlines = [outlineMat, outlineHeadMat, outlineSolid];
  const setOutline = (hex) => { for (const m of outlines) m.visible = hex != null; if (hex != null) outlineMat.color.setHex(hex); };
  setOutline(null);
  const mat = (color, kind = 'cloth') => {
    const [shininess, specular] = SHINE[kind];
    const m = new THREE.MeshPhongMaterial({ color, shininess, specular, side: kind === 'hair' ? THREE.DoubleSide : THREE.FrontSide });
    mats.push(m); return m;
  };
  const part = (geo, material, parent, [x, y, z] = [0, 0, 0], outline = 1.07) => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m);
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
    gender: look.gender || 'male', head: look.head, headWidth: look.headWidth, hair: look.hairModel, hat: look.hat, hatColor: look.hatColor,
    face, photo: look.photo, mat, outlineMat, outlineHeadMat, colors,
  });
  mii.model.scale.setScalar(MII_SCALE * (look.scale || 1));   // look.scale < 1 for kids
  body.add(mii.model);
  const { headFrame: hf, faceFront: fz, eyeY: ey, eyeX: ex, handR, handL } = mii;
  const chest = frameOn(mii.bones.chest);        // torso frame, origin at the chest bone (0.7 m up the body)

  // head accessories (head frame: origin at the neck, face at z = fz, eyes at y = ey)
  if (look.glasses) {                         // lenses angle back a little to follow the face
    const sun = look.glasses === 'sun', frameMat = mat(sun ? '#141418' : look.glassesColor || '#3a3a44');
    for (const sd of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sd * ex, ey, fz - 0.002); g.rotation.y = sd * 0.38; g.scale.setScalar(FACE_SCALE * 0.95); hf.add(g);
      if (sun) { part(sunLensGeo, new THREE.MeshPhongMaterial({ color: 0x15151c, shininess: 90, specular: 0x666666 }), g, [0, 0, 0], 0); part(sunFrameGeo, frameMat, g, [0, 0, 0.001], 0); }
      else part(look.glasses === 'round' ? roundFrameGeo : squareFrameGeo, frameMat, g, [0, 0, 0], 0);
    }
    part(barGeo, frameMat, hf, [0, ey + 0.015, fz + 0.016], 0).scale.x = 1.1;
  }
  if (look.earbuds) for (const x of [-0.27, 0.27]) part(budGeo, mat('#ffffff'), hf, [x, ey - 0.03, 0.03], 0);
  if (look.headset) {                         // over the eyes, or pushed up on the forehead so a photo face shows
    const hs = new THREE.Group(); hf.add(hs);
    if (look.photo) { hs.position.set(0, ey + 0.15, -0.02); hs.rotation.x = -0.45; } else hs.position.y = ey;
    part(headsetGeo, mat('#ececf2'), hs, [0, 0.01, fz - 0.03]);
    part(new THREE.BoxGeometry(0.34, 0.1, 0.02), darkMat, hs, [0, 0.01, fz + 0.045], 0);
    part(headStrapGeo, darkMat, hs, [0, 0.02, 0.0], 0).rotation.x = Math.PI / 2;
  }

  // torso accessories (chest frame: neck at y ≈ 0.39, shoulders ≈ 0.33, chest front at z ≈ 0.12)
  if (look.outfit === 'turtleneck') part(neckGeo, mii.parts.torso, chest, [0, 0.4, 0.0], 1.1);
  if (suitish || look.outfit === 'sweater' || look.collar) {         // shirt collar under a suit / sweater / jacket
    const cm = mat(look.collar || '#ffffff'); cm.side = THREE.DoubleSide;
    part(collarVGeo, cm, chest, [0, 0.335, 0.094], 0).rotation.x = -0.3;
    for (const sd of [-1, 1]) {                  // mirrored flaps, pointing down and out from the neck
      const f = part(collarFlapGeo, cm, chest, [sd * 0.006, 0.36, 0.1], 0);
      f.scale.x = sd; f.rotation.set(-0.3, 0, -sd * 0.75);
    }
    const tie = look.tie === undefined ? (look.outfit === 'suit' ? '#d93a3a' : null) : look.tie;
    if (tie) part(tieGeo, mat(tie), chest, [0, 0.235, 0.125], 0).rotation.x = -0.15;
  }
  if (look.scarf) {
    const sm = mat(look.scarf);
    part(scarfGeo, sm, chest, [0, 0.39, 0.0]).rotation.x = Math.PI / 2;
    part(scarfTailGeo, sm, chest, [0.06, 0.24, 0.13], 0).rotation.z = 0.12;
  }
  if (look.lanyard) {
    const c = part(cordGeo, mat('#e84a7a'), chest, [0, 0.33, 0.04], 0); c.rotation.x = -1.25;
    part(badgeGeo, mat('#ffffff'), chest, [0, 0.2, 0.14], 0);
  }

  // props in the right hand (hand frame: arm along −y, z forward, origin at the wrist)
  let phone = null;
  if (look.phone) { phone = part(phoneGeo, darkMat, handR, [0, -0.06, 0.06], 0); phone.rotation.x = -0.4; }
  if (look.carry === 'device') phone = part(deviceGeo, mat('#ffffff'), handR, [0, -0.06, 0.08]);
  if (look.carry === 'gpu') {
    const tex = gpuTextures(), G = gpuGeo, silver = mat('#c9ced4'), x0 = -GPU_L / 2;
    const texMat = (map) => { const m = mat('#ffffff'); m.map = map; return m; };
    phone = new THREE.Group(); phone.position.set(0, -0.08, 0.06); phone.rotation.x = 2.4; phone.scale.setScalar(1.15); handR.add(phone);  // held out on the palm, fan side tilted toward the viewer
    part(G.pcb, mat('#1f9e72'), phone, [0, -0.023, 0]);                                     // green board
    part(G.fingers, mat('#e3a64a'), phone, [-0.03, -0.023, GPU_W / 2 + 0.01], 0);           // gold PCIe contacts (bottom edge as held)
    part(G.shroud, mat('#232328'), phone, [0.008, 0.001, 0]);                               // black shroud
    part(G.fins, texMat(tex.fins), phone, [x0 + 0.105, 0.0195, 0], 0);                     // heatsink window
    const fx = x0 + 0.24;
    part(G.fan, texMat(tex.fan), phone, [fx, 0.0195, 0], 0);                                // blower fan
    part(G.ring, silver, phone, [fx, 0.02, 0], 0);
    part(G.hub, mat('#eef0f2'), phone, [fx, 0.024, 0], 0);
    part(G.bracket, silver, phone, [x0 - 0.002, -0.01, 0]);                                 // I/O bracket
    part(G.strip, mat('#76b900'), phone, [0.02, 0.001, -GPU_W / 2 + 0.001], 0);             // green accent along the top edge
  }
  if (look.carry === 'soda') phone = part(canGeo, mat('#c8202c'), handR, [0, -0.06, 0.07]);
  // two-hand props, held in front of the body
  let twoHand = false;
  if (look.carry === 'box') {
    twoHand = true;
    const box = part(cardboardGeo, mat('#c8955a'), body, [0, 0.62, 0.34]);
    part(tapeGeo, mat('#e3c08f'), box, [0, 0, 0], 0);
  }

  // ground shadow + click target
  const shadow = new THREE.Mesh(shadowGeo, shadowMat); shadow.position.y = 0.01; shadow.renderOrder = -1; root.add(shadow);
  const hitbox = new THREE.Mesh(hitGeo, hitMat); root.add(hitbox);

  root.userData = { rig: { body, ...mii.bones }, mats, outlineMat, setOutline, hitbox, look, handProp: !!phone, twoHand, headFrame: hf, eyeY: ey };
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
export function pose(person, phase, amp, mode, t, fx) {
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
  // social overlay from crowd.js (all 0..1, eased): talking gestures, waving, nodding, laughing, head turn
  let yaw = 0;
  if (fx && mode !== 'pitch') {
    const mix = (A, to, k) => { for (const key in to) A[key] += (to[key] - A[key]) * k; };
    if (fx.talk > 0.01) {                            // one hand gestures in front of the chest, head bobs
      const sd = fx.hand, H = sd > 0 ? R : L, w = fx.seed;
      mix(H, { ux: -0.35, uz: sd * 0.25, fx: -1.45 + Math.sin(t * 5.5 + w) * 0.35, fz: -sd * 0.25 + Math.sin(t * 3.7 + w) * 0.25 }, fx.talk);
      hx += Math.sin(t * 7 + w) * 0.05 * fx.talk;
    }
    if (fx.wave > 0.01) {                            // arm up beside the head, forearm swinging side to side
      const sd = person.userData.handProp ? -1 : 1, H = sd > 0 ? R : L;
      mix(H, { ux: -0.2, uz: sd * 2.2, fx: -0.25, fz: sd * (2.75 + Math.sin(t * 13) * 0.45) }, fx.wave);
    }
    if (fx.nod > 0.01) hx += Math.max(0, Math.sin(t * 9)) * 0.2 * fx.nod;
    if (fx.laugh > 0.01) {                           // head back, bouncing, a hand on the belly
      hx -= 0.22 * fx.laugh;
      body.position.y += Math.abs(Math.sin(t * 15)) * 0.03 * fx.laugh;
      if (!person.userData.twoHand) mix(L, { ux: -0.4, uz: -0.05, fx: -1.5, fz: 0.5 }, fx.laugh);
    }
    yaw = fx.yaw;
  }
  setBone(legL, s * 0.6, 0, 0); setBone(legR, -s * 0.6, 0, 0);
  armRot(-1, L.ux, L.uz, qUpL); armRot(-1, L.fx, L.fz, qLoL);
  armRot(1, R.ux, R.uz, qUpR); armRot(1, R.fx, R.fz, qLoR);
  setBone(armL, 0, 0, 0, qUpL); setChildBone(foreL, qUpL, qLoL);
  setBone(armR, 0, 0, 0, qUpR); setChildBone(foreR, qUpR, qLoR);
  setBone(head, hx, yaw, 0);
}

/** Encase a person in ice: tint them icy and add a translucent block. Returns the block (scale it in). */
export function encase(person) {
  const ice = new THREE.Color('#cdeeff');
  for (const m of person.userData.mats) m.color.lerp(ice, 0.55);
  person.userData.setOutline(0x3c7fb0);
  const block = new THREE.Mesh(iceGeo, iceMat);
  block.add(new THREE.LineSegments(iceEdges, iceLineMat));
  block.renderOrder = 2;
  person.add(block);
  return block;
}
