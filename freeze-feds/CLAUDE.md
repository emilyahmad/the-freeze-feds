# The Freeze Feds

Web game: a crowd of chibi people walks around a cartoon SF intersection (California & Powell). Hover anyone to inspect them; click a boss to freeze them in ice. 120 s round, +10 s for a right catch, −10 s for a wrong one, ends at 0 s or when all 10 bosses are frozen.

- Stack: Vite + Three.js (vanilla JS). `npm install`, `npm run dev` → http://localhost:5173. `npm run build` → `dist/` (relative paths via `base: './'`, ready for GitHub Pages / itch.io).
- `public/street.webp`: the background photo (1672×941). `index.html` letterboxes a 16:9 `#stage` with the `<img>` behind a transparent WebGL canvas.
- `src/scene.js`: camera matched to the photo by eye (`CAM_HEIGHT`, `CAM_PITCH_DEG`, `CAM_FOV`) and the walk graph. Waypoints are written in **image pixels** and projected onto the ground plane, so tune them against the photo. `?debug` skips the start screen, draws the grid/waypoints/edges, shows the image-pixel coordinates under the cursor and exposes `window.__game`.
- `src/characters.js`: placeholder chibi people (`makePerson(look)`): toon material + inverted-hull outline, randomised colours and accessories, invisible hitbox for raycasting. `CEO_TYPES` lists the 10 bosses (parody caricatures of Holmes, Zuckerberg, Huang, Musk, Thiel, Karp, Gates, Bezos, Dimon, Buffett): a fixed `look` (hair style, outfit, prop via `carry`), the hover-card `info` line and a `behavior`. `pose()` animates limbs; `encase()` freezes. To switch to VRoid/VRM models later, replace `makePerson` and keep its `userData` contract (`rig`, `mats`, `outlineMat`, `hitbox`).
- `src/crowd.js`: agents and behaviours: `wander` (normals), `pace` (phone pacer), `lead` + `follow` (CEO with two assistants), `pitch` (stops to pitch at passers-by), `speed` (fast walker), `slow` (ambles), `loiter` (long still pauses). Normals sometimes wear a single CEO item (phone, hoodie, vest) as decoys.
- `src/ui.js`: hover card (close-up rendered with a second camera on layer 1 into a render target), HUD, popups, screens. `src/sfx.js`: WebAudio-synthesised sounds.
- The bosses are satire: caricatures from public signature looks (hair, outfit, prop) on the generic chibi face, and the hover card describes the outfit rather than naming them. Keep the "Parody" label.

## Roadmap (original plan)

The first playable build (steps 1–6 below with placeholder people) is done. Next up: VRoid models, Mixamo walk cycle, animated background.

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
