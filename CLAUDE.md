# The Freeze Feds

Web game: a crowd of Mii-style people mingles around a cartoon SF intersection (California & Powell). Hover anyone to inspect them; click someone to call them up to the camera for an ID check (they hold up their LinkedIn-style profile on a phone), then click them again to freeze them in ice or anywhere else to let them go. 60 s round, +10 s for a right catch, −10 s for a wrong one, ends at 0 s or when all 9 bosses are frozen.

- Stack: Vite + Three.js (vanilla JS). `npm install`, `npm run dev` → http://localhost:5173. `npm run build` → `dist/` (relative paths via `base: './'`, ready for GitHub Pages / itch.io).
- `public/street.webp`: the background photo (1672×941). `index.html` letterboxes a 16:9 `#stage` with the `<img>` behind a transparent WebGL canvas.
- `src/scene.js`: camera matched to the photo by eye (`CAM_HEIGHT`, `CAM_PITCH_DEG`, `CAM_FOV`) and the walkable area: a polygon in **image pixels** (`WALK_AREA`) covering the far sidewalks, far crosswalk and foreground intersection down to `WALK_BOTTOM`, projected onto the ground plane. `buildWalkArea()` gives containment/clamping and random destinations (`randomPoint()` samples over the image, biased toward the bottom by `NEAR_BIAS`, so people come toward the camera; `randomNear()` picks a spot a few metres away in any direction). Lower `WALK_BOTTOM`/higher `NEAR_BIAS` = closer to the camera, but anyone within ~4 m walls off the street. `?debug` skips the start screen, draws the grid and the area's outline, shows the image-pixel coordinates under the cursor and exposes `window.__game`.
- `src/mii.js`: loads the Mii GLBs from `public/models` (bodies, heads, hair, hats; see its README) before the crowd spawns, and `buildMii()` assembles one: a `SkeletonUtils` clone of the skinned body (shirt split into torso/sleeve/hand and pants into legs/shoes so each gets its own colour), a head shape with ears, a canvas-drawn Wii-style face (almond eyes with coloured irises, tapered brows, shaded nose, two-tone lips, optional moustache/beard/stubble/wrinkles/blush/lashes; drawn at `FACE_SCALE` around `EYE_Y`) projected on with `DecalGeometry`, and a hairstyle or hat. The ripped meshes are welded and re-smoothed at load (Miis are smooth, not faceted). `setBone`/`setChildBone` rotate bones in the character frame (x right, y up, z forward) on top of the T-pose. Shading is soft glossy Phong (`SHINE` in characters.js), like the Wii Miis; outlines are inverted hulls pushed out along normals in the shader (they follow the skinning) and are hidden except as the hover highlight and the frozen-in-ice tint (`userData.setOutline`). The models are git-ignored, so the game needs them in `public/models` to run. The base Mii follows `design-references/fixed_mii.glb`: the head sits `HEAD_LIFT` above the neck bone so a short neck shows, and its fitted default hair is `public/models/character-hair/hair-default.glb` (extracted by `model-sources/extract_hair.mjs`). `buildMii({ headWidth })` > 1 widens the head for a broad face. The ripped hairs sit too tight on some heads (scalp pokes through): `HAIR_HEAD_LIFT` raises hair on the taller heads (03/07/08) and `HAIR_FIT` scales individual hairstyles up about `HAIR_PIVOT`; add a hair there if a bald spot shows (hair-32/33 are balding on purpose).
- Photo faces: `src/mii.js` wraps real photos from `design-references/tech-faces/` onto the front of the Mii head (a `DecalGeometry` per head shape, `photoDecal`) instead of the drawn face. `PHOTO_FACES` maps each boss id to its file with hand-measured eye centres and chin (image pixels), so every photo is scaled/rotated to put its eyes on the Mii eye line; `softEdges` and `PHOTO_OVAL` feather the photo into the head, and the head/ears/hands are tinted to a skin tone sampled from the photo. Photos with glasses drop the 3D glasses; Zuckerberg's headset is pushed up onto his forehead. Anyone without a photo keeps the drawn Mii face; crowd photos in `design-references/remaining-faces/` (AI-generated `rando*.jpeg`, eyes/chin in `CROWD_FACES` in mii.js) go to the background Miis without repeats per round (`resetFaceDeck`), and `CROWD_LOOKS` in characters.js dresses each one to match its photo (gender, hair model/colour, clothes, a smaller `scale` for the kids, hover-card `info`); extra photos in `tech-faces/crowd/` (optional `f-`/`m-` prefix) also join the pool. Assistants keep their uniform look.
- `src/characters.js`: `makePerson(look)` builds a Mii from a look (colours, `head`, `hairModel`, `face`, `gender`) and hangs the accessories on it: glasses, headsets and earbuds on the head frame, collars, ties and scarves on the chest frame, props in the hand frame. `CEO_TYPES` lists the 9 bosses (parody caricatures of Holmes, Zuckerberg, Huang, Thiel, Karp, Gates, Bezos, Dimon, Buffett): a fixed `look` (hair style, outfit, prop via `carry`), the hover-card `info` line and a `behavior`; `CEO_MII` picks their head, hairstyle and face. Boss looks follow the characteristics table the user gave (hair, glasses, face shape, facial hair, outfit) on top of the `fixed_mii` base; the general Mii style follows `../be-elsa/design-references/pictures-of-miis.jpg`. Face extras include `goatee`, `beard`, `moustache`, `stubble`, `wrinkles`, `bushy` brows. `pose()` drives the bones (legs, upper arms and forearms, head) plus a social overlay from crowd.js (`fx`: talking gestures, waving, nodding, laughing, head turn); `encase()` freezes. crowd.js relies on the `userData` contract (`rig`, `mats`, `outlineMat`, `hitbox`).
- `src/crowd.js`: agents and behaviours: `wander` (normals: roam to random destinations, `NEAR_CHANCE` of them close by, and change their mind mid-walk at `RETARGET_RATE`), `pace` (phone pacer), `lead` + `follow` (CEO with two assistants), `pitch` (stops to pitch at passers-by), `speed` (fast walker), `slow` (ambles), `loiter` (long still pauses). Normals sometimes wear a single CEO item (phone, vest) as decoys. Collisions: everyone is a solid circle (`RADIUS`; frozen bosses are bigger immovable ice, `ICE_RADIUS`). `avoid()` steers walkers around people ahead, `collide()` pushes overlaps apart after each step (standing people are heavier than walkers), a hard push starts a lean-away wobble (`bump()`), and anyone blocked for `STUCK_TIME` picks a new target. Walking speeds are `WALK_SPEED` and friends (≈0.75 m/s), with the step rate matched to speed (`STEP_RATE`). Mingling (like Miis in the Mii Channel/Plaza): wanderers form chat circles of up to `CHAT_MAX` (`seekChat`/`layoutGroup`/`chat`/`updateGroups`), take speaking turns with hand gestures while listeners look at the speaker, nod and sometimes laugh, then wave goodbye; passers-by sometimes wave (`greet`); people idle-glance around. Bosses don't mingle, so their tells stay readable. ID check: `inspect(a, onPresent)` walks someone to `INSPECT_SPOT` in front of the camera, `release(a)` sends them back, `freezeAndReturn(a)` freezes them and slides the ice block back home. Freezing (`freezeAndSendOff`) leaves the boss in ice for the stamp, then the block slowly slides off down the street (`SENDOFF_TIME`, `SENDOFF_DIST`), spins gently and fades out (`FADE_FROM`, on per-person cloned materials so shared ones don't fade), and is then retired: out of the scene, hitboxes and collisions, but kept in `crowd.retired` so the end screen still lists them as frozen.
- `src/ui.js`: hover card (close-up rendered with a second camera on layer 1 into a render target), the ID-check `Profile` (a dark-mode LinkedIn-style profile on a phone, styled after `design-references/linkedin.png`: no name; a made-up headline, school, followers and mutuals from `profileFor()`; the phone status bar shows just the time and two icons, a round profile photo rendered the same way, the hover-card description as the About section, and FROZEN/INNOCENT/RELEASED stamps across the screen; bosses get parody headlines/banners/highlights from `BOSS` (hints, no real names) and only show their real name once frozen; ~15% of normals are hustle-posting founders as decoys), HUD, popups, screens. `src/sfx.js`: WebAudio-synthesised sounds. `main.js` runs the check flow (`startCheck`/`endCheck`).
- The bosses are satire: Mii bodies with their real photo faces plus a signature outfit and prop, and the hover card describes the look rather than naming them. Keep the "Parody" label.

## Roadmap (original plan)

The first playable build (steps 1–6 below with placeholder people) is done. The placeholder people have since been replaced with Mii models (`src/mii.js`). Next up: animated background.

Here's a one-day plan. It's web-based, uses free tools only, and uses Three.js for the game itself.

### Stack

- **Game:** Vite + Three.js (vanilla JS), with `@pixiv/three-vrm` to load avatars. No engine install or export step, and the result is a link you can send people.
- **Hosting:** GitHub Pages or itch.io (both free).
- **Avatars:** VRoid Studio (free) makes the characters and exports `.vrm` files.
- **Walk animation:** Mixamo (free Adobe login). Download one walk cycle and retarget it to every VRM. The `three-vrm` repo has a Mixamo example you can copy.
- **Street background:** a free SF photo from Unsplash or Pexels. Check the license.

### The 3D model problem

VRoid is anime-styled, so it won't look like a Mii out of the box. You can get close with a big head, simple eyes and a chibi-proportioned body. It's also slow: about 15–30 minutes per character, so 20 unique ones would eat most of your day.

To avoid that:

1. Hand-make **3–4 base bodies** and **~6 CEO characters** in VRoid. Each CEO should have a signature costume or prop.
2. Get the rest of the crowd by cloning the bases with `SkeletonUtils.clone`. Randomize shirt, skin and hair colors by tinting materials in code, and toggle hats, glasses and bags as child meshes.
3. For a more Mii-like look, use a toon outline or a flat-shaded material in Three.js. This is cheaper than remodeling.

### Core build, in order

1. **Scene (1–1.5h):** Put the street photo in a plain `<img>` behind a transparent WebGL canvas. Match the camera angle by eye, then draw a ground plane and waypoint paths along the sidewalks and crosswalks. When you swap in the animated GIF later, you only change the `<img>` source.
2. **Crowd (1.5h):** Spawn ~20 clones. Each picks a random waypoint, walks to it, pauses, then picks another. Scale each one by its depth on the screen so far ones look smaller.
3. **Hover inspect (1.5h):** Raycast against each character's hitbox. On hover, show a card with a close-up of that character. For the close-up, render them with a second camera into a small render target. Add an info line like "Patagonia vest, phone in hand."
4. **Capture (1h):** On click, check `isCEO`. If it's a CEO, freeze the animation and tint them (ice or handcuffs). If not, play a "wrong" flash.
5. **Round logic (1h):** The timer starts at 120s. A correct capture adds 10s and a wrong one removes 10s. The round ends at 0s or when all CEOs are caught. Add a start screen and a score screen.
6. **Polish (1–2h):** Add sound effects (free from freesound.org or Pixabay), a hover highlight outline and a restart button. Then deploy.

### Making CEOs identifiable both visually and by behavior

- **Visual tells:** The CEOs get distinctive costumes and props.
- **Behavior tells:** Give each type its own movement script:
  - Pacing while staring at a phone.
  - Walking with a flanking entourage.
  - Stopping to "pitch" at passersby.
  - Walking faster than everyone else.
- Normal Miis share the same random-walk behavior.

### Parodying real CEOs

Stick to costume and prop hints, like a signature outfit or accessory. Skip real names and recognizable face likenesses, and add a "parody" label. Satire is generally on solid ground, but that's not legal advice, so be more careful if you plan to monetize. Also, "Mii" is Nintendo's trademark. For a public release, give the game and characters a different name.

### Order of work

Do the walking crowd with placeholder capsule people first, and only then swap in VRoid models. If you run short on time, you still have a playable game.
