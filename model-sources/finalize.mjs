import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const key = n => { const m = n.match(/Mesh_(\d+)\.rip(?:\.(\d+))?/); return m ? +m[1] * 1000 + (+(m[2] ?? 0)) : 0; };
async function fin(src, out, rootName, rename) {
  const doc = await io.read(src); const r = doc.getRoot();
  const meshNodes = r.listNodes().filter(n => n.getMesh());
  rename(meshNodes, r);
  for (const n of meshNodes) n.getMesh().setName(n.getName());
  const top = r.listScenes()[0].listChildren(); if (top.length === 1) top[0].setName(rootName);
  r.listScenes()[0].setName(rootName);
  await doc.transform(prune());
  for (const t of r.listTextures()) t.setURI('');           // embed into the GLB
  await io.write(out, doc);
  console.log(out, meshNodes.map(n => n.getName()).join(' '));
}
const numbered = prefix => nodes => nodes.sort((a, b) => key(a.getName()) - key(b.getName()))
  .forEach((n, i) => n.setName(`${prefix}-${String(i + 1).padStart(2, '0')}`));
const body = (nodes, r) => {
  const by = { polygon0: 'shadow', polygon1: 'pants', polygon2: 'shirt' };
  nodes.forEach(n => n.setName(by[n.getName()] ?? n.getName()));
  // pants/shirt used env0.png as a Wii sphere-map (no UVs); glTF can't express that, so drop it
  for (const m of r.listMaterials()) if (m.getName() !== "mt_shadow") m.setBaseColorTexture(null);
  for (const m of r.listMaterials()) if (m.getName() === "mt_shadow") m.setAlphaMode("BLEND").setBaseColorFactor([1,1,1,1]);
  for (const m of r.listMaterials()) m.setName({ mt_shadow: 'shadow', outer: 'shirt' }[m.getName()] ?? m.getName());
};
await fin('t_head.glb', 'out/heads.glb', 'heads', numbered('head'));
await fin('t_hair.glb', 'out/hair-styles.glb', 'hair-styles', numbered('hair'));
await fin('t_sp.glb', 'out/hats.glb', 'hats', ns => ns.forEach(n => n.setName(n.getName().startsWith('Cap') ? 'cap' : 'beanie')));
await fin('t_maleF.glb', 'out/body-male.glb', 'body-male', body);
await fin('t_female.glb', 'out/body-female.glb', 'body-female', body);
