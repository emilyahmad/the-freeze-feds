# Character models

Put character model files here. They're served at `./models/<file>` (for example `./models/base-body.glb`).

- Preferred formats: `.glb` / `.gltf` (with textures embedded or next to them) or `.vrm` (VRoid Studio exports).
- One file per base body or per character is easiest, named after who it is (e.g. `holmes.glb`, `base-a.glb`).
- Model files in this folder are git-ignored (only this README is committed), so third-party assets stay on your machine.
- Note each model's source and license below, so you know what you're allowed to do with it.

## Sources / licenses

| File | Source | License |
|---|---|---|
| `character-bodies/body-male.glb`, `body-female.glb` | Wii Mii Channel body rip (converted from FBX) | Nintendo asset: local prototyping only, don't ship publicly |
| `character-heads/heads.glb` | Mii head rip (converted from OBJ) | same |
| `character-hair/hair-styles.glb`, `hats.glb` | Mii hair rip (converted from OBJ) | same |

## What's inside

- **Bodies**: skinned meshes `shirt`, `pants`, `shadow` (a ground blob) on a 20-bone rig (`skl_root`, `chest`, `head`, `hip`, `arm_l1/l2`, `wrist_l`, `foot_l1/l2`, `ankle_l`, and the `_r` versions). Units are cm, so the `Armature` and mesh nodes are scaled 0.01. `shirt` and `pants` are plain white, ready to tint in code. The Wii sphere-map shine (`env0.png`) has no glTF equivalent, so it was dropped. Attach a head to the `head` bone.
- **Heads**: `head-01` … `head-08`, the face shapes. They all sit at the origin, overlapping, so show one at a time. The face points along +X.
- **Hair**: `hair-01` … `hair-68`, overlapping at the origin like the heads and lined up to them. `hats.glb` has `cap` and `beanie`, which are textured.
- The original OBJ/FBX/DAE files and the conversion scripts are in `../../model-sources/` (git-ignored, not served). To rebuild: in a folder with `assimpjs` and `@gltf-transform/*` installed, run `convert.mjs` (assimp → GLB), then `finalize.mjs` (renames nodes and embeds textures).
