// Pull the fitted default hair out of design-references/fixed_mii.glb, baked into the head mesh's own
// coordinates (so it attaches like the other hairstyles), and write it as its own GLB.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import * as THREE from '/Users/emilyahmad/Downloads/the-freeze-feds/node_modules/three/build/three.module.js';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src), root = doc.getRoot();
const node = (n) => root.listNodes().find((x) => x.getName() === n);
const head = node('head-default-blank'), hair = node('hair-default-mii');
const M = (n) => new THREE.Matrix4().fromArray(n.getWorldMatrix());
const rel = M(head).invert().multiply(M(hair));                 // hair in head-geometry space
const nrm = new THREE.Matrix3().getNormalMatrix(rel), v = new THREE.Vector3();
const prim = hair.getMesh().listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
for (let i = 0; i < P.getCount(); i++) {
  P.setElement(i, v.fromArray(P.getElement(i, [])).applyMatrix4(rel).toArray());
  if (N) N.setElement(i, v.fromArray(N.getElement(i, [])).applyMatrix3(nrm).normalize().toArray());
}
console.log('relative transform (hair in head space):', rel.elements.map((x) => +x.toFixed(3)).join(' '));
// keep just the hair, with an identity transform, named like the other hairstyles
const scene = root.listScenes()[0];
for (const n of [...scene.listChildren()]) scene.removeChild(n);
hair.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName('hair-default');
hair.getMesh().setName('hair-default'); scene.addChild(hair).setName('hair-default');
for (const n of root.listNodes()) if (n !== hair) n.dispose();
await doc.transform(prune());
await io.write(out, doc);
console.log('wrote', out, 'verts', P.getCount(), 'bounds', P.getMin([]).map((x) => x.toFixed(3)), P.getMax([]).map((x) => x.toFixed(3)));
