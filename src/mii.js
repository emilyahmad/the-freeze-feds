import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeVertices, deinterleaveGeometry } from 'three/addons/utils/BufferGeometryUtils.js';

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
  // the ripped meshes are flat-shaded; Miis are smooth, so weld vertices and recompute soft normals
  const meshes = (scene) => { const out = {}; scene.traverse((o) => { if (o.isMesh) { o.geometry = smooth(o.geometry); out[o.name] = o; } }); return out; };
  assets.heads = meshes(heads.scene);
  assets.hair = meshes(hair.scene);
  hats.scene.traverse((o) => { if (o.isMesh) o.geometry = smooth(o.geometry, true); });
  assets.hats = { cap: hats.scene.getObjectByName('cap'), beanie: hats.scene.getObjectByName('beanie') };
  assets.boneCtl = boneControls(assets.bodies.male);
  for (const name of Object.keys(assets.heads)) assets.heads[name].userData.face = faceAnchor(assets.heads[name].geometry);
}

function smooth(geo, keepUV = false) {
  const g = geo.clone(); deinterleaveGeometry(g); g.deleteAttribute('normal');
  if (!keepUV) g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-3); m.computeVertexNormals(); return m;
}

function prepBody(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (o.name === 'shadow') { o.visible = false; return; }   // the game draws its own ground shadow
    o.geometry = smooth(o.geometry, false);
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
// Modelled on Wii Miis: almond eyes with a coloured iris and a heavy upper lid, thick tapered brows in
// the hair colour, a shaded nose, two-tone lips, optional moustache / beard / wrinkles / blush.
const FACE_W = 0.5;              // decal size, metres
const EYE_Y = 0.335;             // eye height above the neck (head models are ~0.67 tall): mid-head, like a Mii
export const FACE_SCALE = 1.5;         // features are drawn at this scale around the eye line (Mii features are big)

function faceAnchor(geo) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  m.rotation.y = Math.PI / 2; m.updateMatrixWorld();                                   // face → +z
  const cast = (o, d) => new THREE.Raycaster(o, d).intersectObject(m)[0]?.point;
  const front = cast(new THREE.Vector3(0, EYE_Y, 2), new THREE.Vector3(0, 0, -1))?.z ?? 0.25;
  const earY = EYE_Y - 0.04;
  const side = cast(new THREE.Vector3(2, earY, -0.02), new THREE.Vector3(-1, 0, 0))?.x ?? 0.28;
  const decal = new DecalGeometry(m, new THREE.Vector3(0, EYE_Y - 0.08, front), new THREE.Euler(), new THREE.Vector3(FACE_W, FACE_W, 0.5));
  return { front, decal, ear: [side - 0.012, earY, -0.02] };
}

export const EYE_COLORS = ['#2b1d14', '#5a3a22', '#3a6ea5', '#4a7a4a', '#6a6a72'];
const faceTextures = new Map();
function faceTexture(f) {
  const key = JSON.stringify(f);
  if (faceTextures.has(key)) return faceTextures.get(key);
  const S = 512, px = S / FACE_W, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), cx = S / 2, ey = S / 2 - 0.08 * px;   // eye line, 0.08 m above the decal centre
  const ink = '#1e1410', M = (m) => m * px;                             // M(): metres → px
  const P = Math.PI;
  g.lineCap = g.lineJoin = 'round';
  g.translate(cx, ey); g.scale(FACE_SCALE, FACE_SCALE); g.translate(-cx, -ey);
  const path = (pts, close) => { g.beginPath(); g.moveTo(...pts[0]); for (let k = 1; k < pts.length; k++) g.lineTo(...pts[k]); if (close) g.closePath(); };

  // soft shading first (under everything): wrinkles, blush, beard
  if (f.beard) {
    g.fillStyle = f.beard; g.globalAlpha = 0.95;
    g.beginPath();
    g.moveTo(cx - M(0.165), ey + M(0.03));
    g.quadraticCurveTo(cx - M(0.16), ey + M(0.2), cx, ey + M(0.22));
    g.quadraticCurveTo(cx + M(0.16), ey + M(0.2), cx + M(0.165), ey + M(0.03));
    g.lineTo(cx + M(0.12), ey + M(0.06));
    g.quadraticCurveTo(cx + M(0.06), ey + M(0.1), cx, ey + M(0.1));
    g.quadraticCurveTo(cx - M(0.06), ey + M(0.1), cx - M(0.12), ey + M(0.06));
    g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  if (f.stubble) {
    g.fillStyle = 'rgba(40,30,25,.16)';
    g.beginPath(); g.ellipse(cx, ey + M(0.15), M(0.12), M(0.07), 0, 0, P * 2); g.fill();
  }
  if (f.blush) {
    const grad = (x) => { const r = g.createRadialGradient(x, ey + M(0.075), 0, x, ey + M(0.075), M(0.04)); r.addColorStop(0, 'rgba(240,110,120,.45)'); r.addColorStop(1, 'rgba(240,110,120,0)'); return r; };
    for (const sd of [-1, 1]) { g.fillStyle = grad(cx + sd * M(0.1)); g.fillRect(cx + sd * M(0.1) - M(0.05), ey + M(0.025), M(0.1), M(0.1)); }
  }
  if (f.wrinkles) {
    g.strokeStyle = 'rgba(90,50,35,.45)'; g.lineWidth = 3;
    for (const sd of [-1, 1]) {
      const x = cx + sd * M(0.075);
      g.beginPath(); g.moveTo(x + sd * M(0.005), ey + M(0.06)); g.quadraticCurveTo(x + sd * M(0.03), ey + M(0.1), x + sd * M(0.005), ey + M(0.135)); g.stroke();   // smile lines
      g.beginPath(); g.moveTo(x + sd * M(0.045), ey - M(0.008)); g.lineTo(x + sd * M(0.06), ey - M(0.016)); g.stroke();                                          // crow's feet
      g.beginPath(); g.moveTo(x + sd * M(0.045), ey + M(0.006)); g.lineTo(x + sd * M(0.06), ey + M(0.012)); g.stroke();
    }
    g.beginPath(); g.moveTo(cx - M(0.04), ey - M(0.11)); g.lineTo(cx + M(0.04), ey - M(0.11)); g.stroke();                                                       // forehead
  }

  // eyes + brows
  const iris = f.eyeColor || EYE_COLORS[0];
  for (const sd of [-1, 1]) {
    const x = cx + sd * M(0.083);
    const W = M(f.eyes === 'round' ? 0.034 : 0.03), H = M(f.eyes === 'round' ? 0.03 : f.eyes === 'narrow' ? 0.011 : 0.019);
    if (f.eyes === 'happy') {                                        // closed, smiling
      g.strokeStyle = ink; g.lineWidth = 7;
      g.beginPath(); g.arc(x, ey + M(0.012), M(0.022), P * 1.15, P * 1.85); g.stroke();
    } else if (f.eyes === 'dot') {                                   // simple black beads
      g.fillStyle = ink; g.beginPath(); g.ellipse(x, ey, M(0.011), M(0.016), 0, 0, P * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - M(0.004), ey - M(0.006), M(0.004), 0, P * 2); g.fill();
    } else {
      // almond white (slightly pointed toward the nose), clipped iris + pupil, heavy upper lid
      const inner = -sd;                                             // toward the nose
      const eyePath = () => {
        g.beginPath();
        g.moveTo(x + inner * W, ey + H * 0.15);
        g.bezierCurveTo(x + inner * W * 0.6, ey - H * 1.25, x - inner * W * 0.7, ey - H * 1.15, x - inner * W, ey - H * 0.1);
        g.bezierCurveTo(x - inner * W * 0.7, ey + H * 1.05, x + inner * W * 0.5, ey + H * 1.1, x + inner * W, ey + H * 0.15);
        g.closePath();
      };
      eyePath(); g.fillStyle = '#fbfbf6'; g.fill();
      g.save(); eyePath(); g.clip();
      const ir = M(f.eyes === 'round' ? 0.014 : 0.0135), iy = ey + (f.eyes === 'round' ? 0 : M(0.002));
      const ig = g.createRadialGradient(x, iy - ir * 0.3, ir * 0.2, x, iy, ir);
      ig.addColorStop(0, iris); ig.addColorStop(1, '#111');
      g.fillStyle = ig; g.beginPath(); g.arc(x, iy, ir, 0, P * 2); g.fill();
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(x, iy, ir * 0.48, 0, P * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(x - ir * 0.38, iy - ir * 0.4, ir * 0.3, 0, P * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x - W, ey - H * 1.3, W * 2, H * 0.55);   // lid shadow
      g.restore();
      // upper lid line (thicker toward the outside), thin lower line
      g.strokeStyle = ink; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x + inner * W * 1.02, ey + H * 0.12);
      g.bezierCurveTo(x + inner * W * 0.6, ey - H * 1.25, x - inner * W * 0.7, ey - H * 1.15, x - inner * W * 1.1, ey - H * 0.25); g.stroke();
      if (f.lashes) { g.lineWidth = 4; path([[x - inner * W * 1.05, ey - H * 0.2], [x - inner * W * 1.35, ey - H * 0.95]]); g.stroke(); path([[x - inner * W * 0.8, ey - H * 0.7], [x - inner * W * 1.0, ey - H * 1.5]]); g.stroke(); }
      g.lineWidth = 2; g.strokeStyle = 'rgba(30,20,16,.55)';
      g.beginPath(); g.moveTo(x - inner * W * 0.9, ey + H * 0.2); g.bezierCurveTo(x - inner * W * 0.6, ey + H * 1.0, x + inner * W * 0.5, ey + H * 1.05, x + inner * W, ey + H * 0.2); g.stroke();
    }
    // brow: a tapered stroke, thick at the inner end; tilt > 0 = angry (inner end lower)
    const by = ey - M(f.eyes === 'round' ? 0.05 : 0.045), bw = M(0.034), th = M(f.bushy ? 0.016 : 0.009);
    const tilt = (f.browTilt || 0) * M(0.008), innerX = x - sd * bw, outerX = x + sd * bw;
    g.fillStyle = f.brow;
    g.beginPath();
    g.moveTo(innerX, by + tilt - th * 0.5);
    g.quadraticCurveTo(x, by - M(0.01) - th * 0.6, outerX, by - tilt * 0.6 + th * 0.1);
    g.quadraticCurveTo(x, by - M(0.01) + th * 0.7, innerX, by + tilt + th * 0.6);
    g.closePath(); g.fill();
  }

  // nose: shaded underside + nostril curves (Mii noses read through shading, not outlines)
  const ny = ey + M(f.nose === 'long' ? 0.085 : 0.07);
  const nw = M(f.nose === 'big' ? 0.03 : f.nose === 'small' ? 0.016 : 0.022);
  g.fillStyle = 'rgba(120,55,35,.22)';
  g.beginPath(); g.ellipse(cx, ny + M(0.004), nw * 1.05, nw * 0.55, 0, 0, P * 2); g.fill();
  if (f.nose === 'long') { g.strokeStyle = 'rgba(110,55,35,.35)'; g.lineWidth = 3; path([[cx - nw * 0.4, ey + M(0.02)], [cx - nw * 0.55, ny - M(0.01)]]); g.stroke(); }
  g.strokeStyle = 'rgba(95,40,25,.65)'; g.lineWidth = 3.5;
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(cx + sd * nw * 0.55, ny, nw * 0.42, sd > 0 ? -P * 0.35 : P * 0.6, sd > 0 ? P * 0.4 : P * 1.35); g.stroke(); }

  // moustache (over the top lip)
  const my = ey + M(0.135), mw = M(f.mouthW || 0.045);
  if (f.moustache) {
    g.fillStyle = f.moustache;
    g.beginPath(); g.moveTo(cx, my - M(0.028));
    g.bezierCurveTo(cx + mw * 0.7, my - M(0.04), cx + mw * 1.3, my - M(0.02), cx + mw * 1.25, my - M(0.0));
    g.bezierCurveTo(cx + mw * 0.8, my - M(0.012), cx + mw * 0.3, my - M(0.014), cx, my - M(0.012));
    g.bezierCurveTo(cx - mw * 0.3, my - M(0.014), cx - mw * 0.8, my - M(0.012), cx - mw * 1.25, my - M(0.0));
    g.bezierCurveTo(cx - mw * 1.3, my - M(0.02), cx - mw * 0.7, my - M(0.04), cx, my - M(0.028));
    g.fill();
  }

  // mouth: two-tone lips
  const lip = f.lips || '#c4605a', lipDark = 'rgba(90,20,20,.9)';
  const curve = { smile: M(0.012), open: M(0.012), frown: -M(0.009), flat: 0, smirk: 0 }[f.mouth] ?? M(0.006);
  if (f.mouth === 'open') {                                              // open grin with teeth
    g.fillStyle = '#5a1418';
    g.beginPath(); g.moveTo(cx - mw, my - M(0.004)); g.quadraticCurveTo(cx, my + M(0.045), cx + mw, my - M(0.004));
    g.quadraticCurveTo(cx, my + M(0.004), cx - mw, my - M(0.004)); g.fill();
    g.save(); g.clip(); g.fillStyle = '#fff'; g.fillRect(cx - mw, my - M(0.006), mw * 2, M(0.012)); g.restore();
    g.strokeStyle = lip; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - mw, my - M(0.004)); g.quadraticCurveTo(cx, my + M(0.045), cx + mw, my - M(0.004)); g.stroke();
  } else {
    const l = cx - mw, r = cx + mw, ly = my - curve * 0.6, ry = f.mouth === 'smirk' ? my - M(0.012) : ly;
    // lower lip (lighter, fuller), upper lip (darker, thin), then the parting line
    g.fillStyle = lip;
    g.beginPath(); g.moveTo(l, ly); g.quadraticCurveTo(cx, my + curve + M(0.022), r, ry); g.quadraticCurveTo(cx, my + curve, l, ly); g.fill();
    g.fillStyle = shade(lip, -0.25);
    g.beginPath(); g.moveTo(l, ly); g.quadraticCurveTo(cx - mw * 0.5, my + curve * 0.3 - M(0.014), cx, my + curve * 0.4 - M(0.008));
    g.quadraticCurveTo(cx + mw * 0.5, my + curve * 0.3 - M(0.014), r, ry); g.quadraticCurveTo(cx, my + curve, l, ly); g.fill();
    g.strokeStyle = lipDark; g.lineWidth = 3;
    g.beginPath(); g.moveTo(l, ly); g.quadraticCurveTo(cx, my + curve * 1.6, r, ry); g.stroke();
  }

  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = new THREE.MeshPhongMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, shininess: 30, specular: 0x222222 });
  faceTextures.set(key, mat);
  return mat;
}
const shade = (hex, k) => '#' + new THREE.Color(hex).offsetHSL(0, 0, k * 0.4).getHexString();

const earGeo = new THREE.SphereGeometry(1, 16, 12).scale(0.024, 0.05, 0.036);

/**
 * Build one Mii: body (cloned skinned rig), head, face, hair or hat.
 * Returns the model plus the bones and frames that characters.js hangs accessories on.
 */
export function buildMii({ gender = 'male', head = 'head-01', hair = null, hat = null, hatColor, face, mat, outlineMat, outlineHeadMat, colors }) {
  const model = SkeletonUtils.clone(assets.bodies[gender]);
  const bone = (n) => model.getObjectByName(n);
  const parts = {};
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.frustumCulled = false;
    const names = o.name === 'shirt' ? SHIRT_PARTS : PANTS_PARTS;
    o.material = names.map((n) => (parts[n] = mat(colors[n], n === 'hand' ? 'skin' : 'cloth')));
    const ol = new THREE.SkinnedMesh(o.geometry, outlineMat);
    ol.position.copy(o.position); ol.quaternion.copy(o.quaternion); ol.scale.copy(o.scale);
    ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false;
    o.parent.add(ol);
  });

  // head frame: character axes in metres, origin at the neck, turning with the head bone
  const headFrame = frameOn(bone('head'));
  const headSrc = assets.heads[head] || assets.heads['head-01'];
  const headMesh = new THREE.Mesh(headSrc.geometry, parts.skin = mat(colors.skin, 'skin'));
  headMesh.rotation.y = Math.PI / 2; headFrame.add(headMesh);
  const [ex, ey, ez] = headSrc.userData.face.ear;
  for (const sd of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, parts.skin); ear.position.set(sd * ex, ey, ez); ear.rotation.y = sd * 0.35;
    ear.add(new THREE.Mesh(earGeo, outlineHeadMat)); headFrame.add(ear);
  }
  headMesh.add(new THREE.Mesh(headSrc.geometry, outlineHeadMat));
  const faceMesh = new THREE.Mesh(headSrc.userData.face.decal, faceTexture(face));
  faceMesh.renderOrder = 1; headFrame.add(faceMesh);

  if (hair && !hat && assets.hair[hair]) {
    const h = new THREE.Mesh(assets.hair[hair].geometry, parts.hair = mat(colors.hair, 'hair'));
    parts.hair.side = THREE.DoubleSide; h.rotation.y = Math.PI / 2; headFrame.add(h);
  }
  if (hat) {
    const h = assets.hats[hat].clone(); h.rotation.y = Math.PI / 2;
    h.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material, m = mat(src.map ? hatColor : '#2a2a30', 'cloth');
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
    headFrame, faceFront: headSrc.userData.face.front, eyeY: EYE_Y, eyeX: 0.083 * FACE_SCALE,
    handL: handFrame('wrist_r', -1), handR: handFrame('wrist_l', 1),
  };
}
