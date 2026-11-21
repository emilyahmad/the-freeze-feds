import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// Mii-style building blocks from the GLBs in public/models (see public/models/README.md):
// a skinned T-pose body (faces +Z, cm units under a 0.01 Armature), 8 head shapes, 68 hairstyles and
// two hats. Heads/hair/hats face −X and sit with their base on the neck, in metres.

const MODELS = './models/';
const assets = {};

// shirt triangles are split into torso / sleeves / hands, pants into legs / shoes, so each part can
// get its own colour (vest over a shirt, skin-coloured hands, dark shoes) while sharing one geometry
export const SHIRT_PARTS = ['torso', 'sleeve', 'hand'], PANTS_PARTS = ['legs', 'shoes'];

export async function loadMiiModels() {
  const loader = new GLTFLoader();
  const load = (f) => loader.loadAsync(MODELS + f);
  const [male, female, heads, hair, hats] = await Promise.all([
    load('character-bodies/body-male.glb'), load('character-bodies/body-female.glb'),
    load('character-heads/heads.glb'), load('character-hair/hair-styles.glb'), load('character-hair/hats.glb'),
  ]);
  assets.bodies = { male: prepBody(male.scene), female: prepBody(female.scene) };
  const meshes = (scene) => { const out = {}; scene.traverse((o) => { if (o.isMesh) out[o.name] = o; }); return out; };
  assets.heads = meshes(heads.scene);
  assets.hair = meshes(hair.scene);
  assets.hats = { cap: hats.scene.getObjectByName('cap'), beanie: hats.scene.getObjectByName('beanie') };
  assets.boneCtl = boneControls(assets.bodies.male);
  for (const name of Object.keys(assets.heads)) assets.heads[name].userData.face = faceAnchor(assets.heads[name].geometry);
}

function prepBody(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name === 'shadow') o.visible = false;   // the game draws its own ground shadow
    if (o.name === 'shirt') splitParts(o.geometry, (p, joint) =>
      Math.abs(p.x) > 57 ? 2 : /^(arm|wrist)/.test(joint) ? 1 : 0, o, 2);
    if (o.name === 'pants') splitParts(o.geometry, (p) => (-p.z < 9 ? 1 : 0), o, 1);
  });
  return scene;
}

/** Re-order a geometry's triangles into groups by part (classify(vertexPos, dominantJointName) → part index). */
const geoTop = (a, b, c, last) => {
  const g = a === b || a === c ? a : b === c ? b : Math.min(a, b, c);
  return g === last && !(a === b && b === c) ? g - 1 : g;
};
function splitParts(geo, classify, mesh, partsMax) {
  const pos = geo.attributes.position, J = geo.attributes.skinIndex, W = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones, p = new THREE.Vector3();
  const part = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = 0; for (let k = 1; k < 4; k++) if (W.getComponent(i, k) > W.getComponent(i, best)) best = k;
    part[i] = classify(p.fromBufferAttribute(pos, i), bones[J.getComponent(i, best)].name);
  }
  const idx = geo.index.array, buckets = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = part[idx[t]], b = part[idx[t + 1]], c = part[idx[t + 2]];
    // majority vote; the last part (hands / shoes) only when the whole triangle is in it, so its
    // colour doesn't spike up the sleeve or leg
    const top = geoTop(a, b, c, partsMax);
    (buckets[top] ??= []).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const out = []; geo.clearGroups();
  buckets.forEach((tris, g) => { if (!tris) return; geo.addGroup(out.length, tris.length, g); out.push(...tris); });
  geo.setIndex(out);
}

// Per bone: rest local rotation and the parent's rest rotation in the Armature frame, so poses can be
// written as rotations in the character's own frame (x right, y up, z forward) about each joint.
function boneControls(scene) {
  const arm = scene.getObjectByName('Armature'), ctl = {};
  scene.traverse((b) => {
    if (!b.isBone) return;
    const P = new THREE.Quaternion();
    for (let o = b.parent; o && o !== arm; o = o.parent) P.premultiply(o.quaternion);
    ctl[b.name] = { rest: b.quaternion.clone(), P, Pinv: P.clone().invert(), restWorld: P.clone().multiply(b.quaternion) };
  });
  return ctl;
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const DOWN_PX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); // T-pose arm on +x → hanging
const DOWN_NX = DOWN_PX.clone().invert();

/** Rotate a bone by (x, y, z) Euler radians in the character frame, on top of an optional pre-rotation. */
export function setBone(bone, x, y, z, pre) {
  const c = assets.boneCtl[bone.name];
  _q.setFromEuler(_e.set(x, y, z)); if (pre) _q.multiply(pre);
  bone.quaternion.copy(c.Pinv).multiply(_q).multiply(c.P).multiply(c.rest);
}
export const armDown = (side) => (side > 0 ? DOWN_PX : DOWN_NX);

/** Rotate a child bone (e.g. a forearm) to world rotation R, given its parent's world rotation parentR (both character frame). */
const _p = new THREE.Quaternion();
export function setChildBone(bone, parentR, R) {
  const c = assets.boneCtl[bone.name];
  _p.copy(parentR).invert().multiply(R);
  bone.quaternion.copy(c.Pinv).multiply(_p).multiply(c.P).multiply(c.rest);
}
/** Character-frame rotation for an arm: hang it down, then apply (x, y, z) Euler. */
export const armRot = (side, x, z, out = new THREE.Quaternion()) => out.setFromEuler(_e.set(x, 0, z)).multiply(side > 0 ? DOWN_PX : DOWN_NX);

/** A group on `bone` whose frame is the character frame in metres (it turns with the bone). */
export function frameOn(bone) {
  const g = new THREE.Group();
  g.quaternion.copy(assets.boneCtl[bone.name].restWorld).invert();
  g.scale.setScalar(100);
  bone.add(g);
  return g;
}

// ---- outlines (inverted hull, pushed out along normals; works on skinned meshes too) ----
export function outlineMaterial(color, width) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.outlineW = { value: width };
    s.vertexShader = s.vertexShader.replace('void main() {', 'uniform float outlineW;\nvoid main() {')
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normalize( normal ) * outlineW;');
  };
  m.customProgramCacheKey = () => 'outline';
  m.userData.width = width;
  return m;
}

// ---- face: Mii-style features drawn on a canvas and projected onto the front of the head ----
const FACE_W = 0.5;              // decal size, metres
const EYE_Y = 0.3;               // eye height above the neck (head models are ~0.67 tall)

function faceAnchor(geo) {
  const m = new THREE.Mesh(geo); m.rotation.y = Math.PI / 2; m.updateMatrixWorld();   // face → +z
  const ray = new THREE.Raycaster(new THREE.Vector3(0, EYE_Y, 2), new THREE.Vector3(0, 0, -1));
  m.material.side = THREE.DoubleSide;
  const hit = ray.intersectObject(m)[0];
  const front = hit ? hit.point.z : 0.25;
  const decal = new DecalGeometry(m, new THREE.Vector3(0, EYE_Y - 0.06, front), new THREE.Euler(), new THREE.Vector3(FACE_W, FACE_W, 0.5));
  return { front, decal };
}

const faceTextures = new Map();
function faceTexture(f) {
  const key = JSON.stringify(f);
  if (faceTextures.has(key)) return faceTextures.get(key);
  const S = 256, px = S / FACE_W, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cx = S / 2, ey = S / 2 - 0.06 * px;   // eyes sit 0.06 m above the decal centre
  const ink = '#2b1d14';
  g.lineCap = g.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const x = cx + side * 0.092 * px;
    if (f.eyes === 'wide') {                       // wide, unblinking
      g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x, ey, 19, 23, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#3a6ea5'; g.beginPath(); g.arc(x, ey, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.beginPath(); g.arc(x, ey, 5, 0, Math.PI * 2); g.fill();
    } else if (f.eyes === 'happy') {               // closed, smiling arcs
      g.strokeStyle = ink; g.lineWidth = 6;
      g.beginPath(); g.arc(x, ey + 6, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else {
      const [rx, ry] = f.eyes === 'dot' ? [7, 10] : [10, 15];
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, ey, rx + 5, ry + 4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink; g.beginPath(); g.ellipse(x, ey + 2, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - rx * 0.35, ey - ry * 0.35, rx * 0.35, 0, Math.PI * 2); g.fill();
      if (f.eyes === 'lash') { g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.moveTo(x + side * (rx + 2), ey - ry * 0.6); g.lineTo(x + side * (rx + 9), ey - ry - 2); g.stroke(); }
    }
    // brows
    g.strokeStyle = f.brow; g.lineWidth = f.bushy ? 11 : 6;
    const by = ey - 32 - (f.eyes === 'wide' ? 6 : 0), tilt = f.browTilt * side;
    g.beginPath(); g.moveTo(x - 16, by + tilt * 4); g.quadraticCurveTo(x, by - 6, x + 16, by - tilt * 4); g.stroke();
    if (f.blush) { g.fillStyle = 'rgba(255,120,140,.35)'; g.beginPath(); g.ellipse(x + side * 18, ey + 44, 16, 9, 0, 0, Math.PI * 2); g.fill(); }
  }
  // nose
  g.strokeStyle = 'rgba(80,40,20,.45)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(cx - 6, ey + 34); g.quadraticCurveTo(cx, ey + 40, cx + 6, ey + 34); g.stroke();
  // mouth
  const my = ey + 64; g.strokeStyle = '#7a2a2a'; g.lineWidth = 5;
  if (f.mouth === 'open') {
    g.fillStyle = '#8a2a2a'; g.beginPath(); g.moveTo(cx - 20, my - 4); g.quadraticCurveTo(cx, my + 26, cx + 20, my - 4); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(cx - 14, my - 3, 28, 5);
  } else if (f.mouth === 'flat') { g.beginPath(); g.moveTo(cx - 14, my); g.lineTo(cx + 14, my); g.stroke(); }
  else if (f.mouth === 'smirk') { g.beginPath(); g.moveTo(cx - 16, my + 2); g.quadraticCurveTo(cx + 4, my + 6, cx + 18, my - 6); g.stroke(); }
  else { g.beginPath(); g.moveTo(cx - 18, my - 3); g.quadraticCurveTo(cx, my + 12, cx + 18, my - 3); g.stroke(); }

  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  faceTextures.set(key, mat);
  return mat;
}

/**
 * Build one Mii: body (cloned skinned rig), head, face, hair or hat.
 * Returns the model plus the bones and frames that characters.js hangs accessories on.
 */
export function buildMii({ gender = 'male', head = 'head-01', hair = null, hat = null, hatColor, face, toon, outlineMat, outlineHeadMat, colors }) {
  const model = SkeletonUtils.clone(assets.bodies[gender]);
  const bone = (n) => model.getObjectByName(n);
  const parts = {};
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.frustumCulled = false;
    const names = o.name === 'shirt' ? SHIRT_PARTS : PANTS_PARTS;
    o.material = names.map((n) => (parts[n] = toon(colors[n])));
    const ol = new THREE.SkinnedMesh(o.geometry, outlineMat);
    ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
    ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false;
    o.parent.add(ol);
  });

  // head frame: character axes in metres, origin at the neck, turning with the head bone
  const headFrame = frameOn(bone('head'));
  const headSrc = assets.heads[head] || assets.heads['head-01'];
  const headMesh = new THREE.Mesh(headSrc.geometry, parts.skin = toon(colors.skin));
  headMesh.rotation.y = Math.PI / 2; headFrame.add(headMesh);
  headMesh.add(new THREE.Mesh(headSrc.geometry, outlineHeadMat));
  const faceMesh = new THREE.Mesh(headSrc.userData.face.decal, faceTexture(face));
  faceMesh.renderOrder = 1; headFrame.add(faceMesh);

  if (hair && !hat && assets.hair[hair]) {
    const h = new THREE.Mesh(assets.hair[hair].geometry, parts.hair = toon(colors.hair));
    parts.hair.side = THREE.DoubleSide; h.rotation.y = Math.PI / 2; headFrame.add(h);
  }
  if (hat) {
    const h = assets.hats[hat].clone(); h.rotation.y = Math.PI / 2;
    h.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material, m = toon(src.map ? hatColor : '#2a2a30');
      if (src.map) m.map = src.map;
      o.material = m;
    });
    headFrame.add(h);
  }

  // hand frames: the old capsule-arm frame (arm hanging along −y, z forward), origin at the wrist
  const handFrame = (name, side) => {
    const g = new THREE.Group();
    g.quaternion.copy(assets.boneCtl[name].restWorld).invert().multiply(armDown(side).clone().invert());
    g.scale.setScalar(100); bone(name).add(g); return g;
  };

  return {
    model, parts,
    bones: {
      head: bone('head'), chest: bone('chest'),
      armL: bone('arm_r1'), armR: bone('arm_l1'),       // armL/armR = the arms on −x/+x, as in the old rig
      foreL: bone('arm_r2'), foreR: bone('arm_l2'),
      legL: bone('foot_r1'), legR: bone('foot_l1'),
    },
    headFrame, faceFront: headSrc.userData.face.front, eyeY: EYE_Y,
    handL: handFrame('wrist_r', -1), handR: handFrame('wrist_l', 1),
  };
}
