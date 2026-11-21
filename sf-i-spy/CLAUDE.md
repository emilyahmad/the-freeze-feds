# SF I-Spy

Prototype game: first-person walking footage of San Francisco. Every 8 s the video freezes and the player has 5 s to click the object in the "I spy…" clue (Waymo, AI billboard, cable car, etc.).

- `server.mjs`: Node http server. Serves `index.html` and video files (with Range support for seeking), plus `GET /api/health` (the page checks it on load) and `POST /api/find`, which sends a JPEG frame to Claude (`claude-opus-5-5`, effort low, structured JSON output, server-side refusal fallback) and returns `{found, label, clue, box}` with the box normalised to 0..1.
- `index.html`: the whole game. Footage is the YouTube video `ovRLPTaV8N8` ("Walking San Francisco, Feb 11 2025" by Caliwalks), embedded with the official IFrame Player API (never download it). Override with `?v=<id>&t=<startSeconds>`.
- Frame capture: a cross-origin iframe's pixels can't be read, so on Start the page asks to share the current tab (`getDisplayMedia`, `preferCurrentTab`). At each freeze it hides its own UI, grabs the tab frame, crops to the 16:9 player rect, and sends it to `/api/find`. Scanning therefore happens at freeze time (a few seconds of "Claude is spying…").
- Guessing: a tap (`pointerdown`) is an instant guess. A spotlight circle (radius `SPOT_FRAC` × the video's shorter side, min `SPOT_MIN` px) appears there; it's a hit if the circle overlaps Claude's box. Hits snap the spotlight onto the box; misses shake and show the box in yellow.
- Run: `npm install`, then `ANTHROPIC_API_KEY=... npm start` → http://localhost:8000 (`PORT=...` to change). It must be served by `server.mjs`; a plain static server shows the page but Claude can't spot anything.
- Self-contained: everything lives in this folder; `server.mjs` resolves files relative to itself, so the folder can sit anywhere in a bigger project.
- Tuning constants are at the top of the script in `index.html` (FREEZE_EVERY, GUESS_TIME, SPOT_FRAC, SCAN_MS, …) and the target-picking prompt is `PROMPT` in `server.mjs`.
