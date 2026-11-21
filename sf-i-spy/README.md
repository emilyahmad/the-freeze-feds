# SF I-Spy 🌁

An "I spy" game on a first-person walk through San Francisco. Every 8 seconds the video freezes ("FREEZE!" ❄️), Claude picks something in the frame (a Waymo, an AI billboard, a cable car…), and you get 5 seconds to tap it.

## Run

```bash
cd sf-i-spy
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start     # PORT=3001 npm start to use another port
```

Open http://localhost:8000, press **Start walking**, and when the browser asks, share **this tab** (that's how Claude sees each frozen frame; nothing is recorded or saved). Use Chrome or Edge.

Run it with `npm start`, not a static file server: the game needs the `/api/find` endpoint in `server.mjs`.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game (YouTube player, freeze effect, tap-to-spotlight guessing) |
| `server.mjs` | Small Node server: serves the page, `GET /api/health`, `POST /api/find` (sends the frame to Claude) |
| `package.json` | One dependency: `@anthropic-ai/sdk` |
| `CLAUDE.md` | Implementation notes for Claude Code |

## Options

- Different video or start time: `http://localhost:8000/?v=<youtubeId>&t=<seconds>`
- Timing and difficulty: constants at the top of the script in `index.html` (`FREEZE_EVERY`, `GUESS_TIME`, `SPOT_FRAC`, …)
- What Claude looks for: `PROMPT` in `server.mjs`

Footage: “Walking San Francisco, California (February 11, 2025)” by [Caliwalks](https://www.youtube.com/@caliwalks), embedded via YouTube's player.
