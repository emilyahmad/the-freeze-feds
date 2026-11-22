# The Freeze Feds 🧊

A crowd of chibi people strolls around California & Powell. Ten tech and finance bosses are hiding among them. Hover over anyone to inspect them, and click a boss to freeze them in ice.

- The round lasts **120 s**. A right catch adds **+10 s** and a wrong one costs **−10 s**.
- The round ends when time runs out or when all ten bosses are frozen.
- The bosses are parody caricatures, recognisable by their signature look **and** by how they move:

| Boss | Look | Moves |
|---|---|---|
| Elizabeth Holmes | black turtleneck, blonde bun, wide eyes, tiny blood-test gadget | paces, staring down |
| Mark Zuckerberg | grey tee, curly hair, VR headset | speed-walks |
| Jensen Huang | black leather jacket, silver hair, graphics chip | stops to pitch at people |
| Elon Musk | black tee, carrying a kitchen sink | speed-walks |
| Peter Thiel | navy suit, open collar, receding hairline | loiters and watches |
| Alex Karp | wild grey curls, bright scarf | stops to pitch at people |
| Bill Gates | V-neck sweater over a collar, round glasses | paces, staring down |
| Jeff Bezos | bald, sunglasses, puffer vest, cardboard box | walks with two assistants |
| Jamie Dimon | silver swept hair, dark suit, blue shirt | walks with two assistants |
| Warren Buffett | white hair, bushy brows, grey suit, can of soda | ambles slowly |

Some ordinary people wear a single similar item (a phone, a hoodie, a vest) as a decoy. The hover card describes the outfit, not the name, so spotting who's who is part of the game.

This is satire: the characters are caricatures built from public signature looks, and nobody depicted endorses it.

## Run

```sh
npm install      # first time only
npm run dev
```

Open http://localhost:5173.

- `npm run build` makes a static site in `dist/` (relative paths, ready for GitHub Pages or itch.io). Use `npm run preview` to try it.
- http://localhost:5173/?debug skips the start screen and draws the ground grid, the waypoints and the paths. It also shows the image-pixel coordinates under the cursor, which makes it easy to line things up with the photo.

## Layout

```
freeze-feds/
├── index.html           stage (photo + WebGL canvas), HUD, hover card, start/score screens
├── public/street.webp   background photo (1672×941)
└── src/
    ├── main.js          renderer, game loop, hover/click, round timer
    ├── scene.js         camera matched to the photo, walk graph (waypoints in image pixels)
    ├── characters.js    placeholder chibi people, CEO archetypes, poses, ice block
    ├── crowd.js         walking and CEO behaviours
    ├── ui.js            hover card close-up, HUD, popups, screens
    ├── sfx.js           synthesised sound effects
    └── style.css
```

## Tuning

- **Camera:** `CAM_HEIGHT`, `CAM_PITCH_DEG` and `CAM_FOV` in `src/scene.js`.
- **Walk paths:** `NODES` and `EDGES` in `src/scene.js`. Nodes are pixel positions on the photo.
- **Crowd size and speeds:** the constants at the top of `src/crowd.js`.
- **Boss looks, card lines and behaviours:** `CEO_TYPES` in `src/characters.js`.
- **Round timing:** `ROUND_TIME`, `BONUS` and `PENALTY` in `src/main.js`.

## Next steps

The people are placeholder models for now. The plan is to replace them with VRoid characters (`@pixiv/three-vrm`) and a Mixamo walk cycle, and later to use an animated background. See the roadmap in `CLAUDE.md`.
