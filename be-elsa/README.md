# Ice Magic ❄

A webcam hand-gesture winter scene: a lavender dusk sky, frosted trees, a cobblestone path and a glowing igloo. Your hand gestures make snow, frost, snowballs and snowmen.

## Structure

```
be-elsa/
├── index.html            # page markup + the tutorial card, legend and toast
├── css/style.css         # UI styling (palette tokens live in :root)
├── js/main.js            # gestures, scenery, effects and the main loop (ES module)
└── design-references/    # moodboard images the visual style is based on (local only, not in the repo)
```

## Running

`js/main.js` is an ES module, and the browser needs camera access, so serve the folder over HTTP. Opening `index.html` straight from disk won't work. Any static server will do:

```sh
cd be-elsa
python3 -m http.server 8000
# then open http://localhost:8000
```

Camera access only works on `localhost` or over HTTPS.

## Dropping into another project

- Copy the folder anywhere your project serves static files (for example `public/be-elsa/`) and open `/be-elsa/`.
- The paths are relative (`css/style.css`, `js/main.js`), so the folder works at any URL path.
- It loads these external resources at runtime (it needs internet access):
  - MediaPipe Tasks Vision `0.10.14` from cdn.jsdelivr.net
  - The hand landmarker model from storage.googleapis.com
  - The Fredoka font from Google Fonts
- The page takes over the full viewport (`overflow:hidden`, a fixed canvas). To embed it inside an existing page, put it in an `<iframe allow="camera">` instead of merging the markup.

## Gestures

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
