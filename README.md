# The Freeze Feds ❄

⋆❆˚｡₊⊹❅⋆

Three winter-themed browser games, each in its own folder:

| Folder | Game | What it is | Needs |
|---|---|---|---|
| [`be-elsa/`](be-elsa/) | **Be Elsa** (Ice Magic) | Use your hands in front of the webcam to make snow, frost, snowballs, ice towers, aurora and snow buddies | Webcam, internet, any static web server |
| [`sf-i-spy/`](sf-i-spy/) | **SF I-Spy** | Walk through San Francisco; every 8 s the video freezes and you have 5 s to tap what Claude spotted | Node 18+, an Anthropic API key, Chrome or Edge |
| [`freeze-feds/`](freeze-feds/) | **The Freeze Feds** | A crowd walks around California & Powell; hover to inspect people and click the ten tech and finance bosses (parody caricatures) to freeze them in ice before the clock runs out | Node 18+ |

```
the-freeze-feds/
├── index.html            launcher page with a button for each game
├── be-elsa/              Be Elsa (static site, no install)
│   ├── index.html        the game (uses css/ and js/)
│   ├── standalone.html   same game in a single file
│   ├── css/  js/
│   └── README.md
├── sf-i-spy/             SF I-Spy (Node server + page)
│   ├── index.html  server.mjs  package.json
│   └── README.md
└── freeze-feds/          The Freeze Feds (Vite + Three.js)
    ├── index.html  src/  public/street.webp
    └── README.md
```

## Get the code

```sh
git clone https://github.com/emilyahmad/the-freeze-feds.git
cd the-freeze-feds
```

## How to play each game

The two games run on different ports, so you can have both open at once (one terminal each).

### ❄ Be Elsa

```sh
cd the-freeze-feds
python3 -m http.server 8080
```

Then open **http://localhost:8080/be-elsa/** and allow the camera.

- Any static server works (`npx serve`, VS Code Live Server, …). It just has to be `http://localhost` or HTTPS: opening `index.html` straight from disk won't work, because browsers only allow the camera and ES modules on a served page.
- Serving the repo root like this also gives you the launcher at **http://localhost:8080**, with buttons for both games.
- `be-elsa/standalone.html` is the same game as a single file.

### 🌁 SF I-Spy

```sh
cd the-freeze-feds/sf-i-spy
npm install                               # first time only
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Then open **http://localhost:8000**, press **Start walking**, and share **this tab** when the browser asks. That's how Claude sees each frozen frame; nothing is recorded or saved.

- It must run with `npm start`, because the page needs its server to talk to Claude. Served any other way, the Start button says "Game server not running".
- Another port: `PORT=3001 npm start`.
- The launcher's SF I-Spy button links to http://localhost:8000 and shows whether this server is running.

### 🧊 The Freeze Feds

```sh
cd the-freeze-feds/freeze-feds
npm install                               # first time only
npm run dev
```

Then open **http://localhost:5173** and press **Start the shift**. Ten tech and finance bosses (parody caricatures) are hiding in the crowd. Hover over people to inspect them, and click a boss to freeze them in ice (+10 s). Clicking anyone else costs 10 s. The round lasts 120 s.

- `?debug` (http://localhost:5173/?debug) shows the walk paths and pixel coordinates, for lining people up with the photo.
- `npm run build` makes a static `dist/` folder you can host on GitHub Pages or itch.io.
- More detail: [`freeze-feds/README.md`](freeze-feds/README.md).

## Be Elsa: gestures

A lavender dusk winter scene drawn on a full-screen canvas. MediaPipe's hand tracker follows your hand through the webcam, and each gesture triggers an effect:

| Gesture | Effect |
| --- | --- |
| ✋ open palm | Snowfall (two palms = blizzard) |
| ☝️ point | Draw sparkly frost / poke snowflakes |
| ✊ fist | Pack a snowball; slam down for ice spikes |
| ✊ → 🖐 push & open | Throw the snowball at the screen |
| 🤏 pinch | Snowflake |
| ✌️ peace | Ice tower |
| 🤟 three fingers | Aurora |
| 👍 thumbs up | Snow buddy |
| 🤘 rock on (hold) | Thaw / clear everything (or press `c`) |

At runtime it loads MediaPipe Tasks Vision `0.10.14` (jsDelivr), the hand model (storage.googleapis.com) and the Fredoka font (Google Fonts). More detail: [`be-elsa/README.md`](be-elsa/README.md).

## SF I-Spy: how a round works

The footage is "Walking San Francisco, California (February 11, 2025)" by [Caliwalks](https://www.youtube.com/@caliwalks), embedded with YouTube's player.

1. Every 8 seconds the video freezes with a **FREEZE!** blast of ice emojis.
2. The page captures the frame and sends it to `server.mjs`, which asks Claude (`claude-opus-5-5`) to pick something San Francisco-specific (a Waymo, an AI billboard, a cable car…) and return a clue and its location.
3. You have 5 seconds to tap it. Your tap lights up a spotlight circle: if it touches the object it snaps on in green, otherwise it shakes and Claude's answer appears in yellow.

Options: `?v=<youtubeId>&t=<seconds>&speed=<0.25–2>` for another video, start time or playback speed (default 2×), the timing constants at the top of the script in `sf-i-spy/index.html`, and what Claude looks for in `PROMPT` in `sf-i-spy/server.mjs`. More detail: [`sf-i-spy/README.md`](sf-i-spy/README.md).

## Keeping your API key safe

Never commit your Anthropic API key. Pass it on the command line as shown above, or put `ANTHROPIC_API_KEY=...` in `sf-i-spy/.env`, which git ignores, and start with `node --env-file=.env server.mjs` (Node 20.6 or newer; `npm start` doesn't read `.env` by itself).

`.gitignore` also leaves out `node_modules/` (run `npm install` after cloning), `.DS_Store`, and the local reference images.

## Troubleshooting

- **Port already in use:** another server is on that port. Stop it, or pick another port (`python3 -m http.server 8081`, `PORT=3001 npm start`).
- **SF I-Spy taps do nothing / "Game server not running":** start it with `npm start` inside `sf-i-spy/`, and open the port it prints.
- **Be Elsa shows no camera:** open it through `http://localhost:…` (not as a file) and allow camera access in the browser.
