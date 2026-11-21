// SF I-Spy: static file server + /api/find, which asks Claude to pick a target in a video frame.
// Run: ANTHROPIC_API_KEY=... npm start   → http://localhost:8000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic, { AuthenticationError, RateLimitError, APIConnectionError, APIError } from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;
const client = new Anthropic();

const SCHEMA = {
  type: "object",
  properties: {
    found: { type: "boolean", description: "false if nothing in the frame is distinct enough to be a fair target" },
    label: { type: "string", description: "Short name of the target, e.g. 'Waymo robotaxi'" },
    clue: { type: "string", description: "Playful 'I spy…' clue, max 8 words, that identifies it without being vague" },
    x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" },
  },
  required: ["found", "label", "clue", "x0", "y0", "x1", "y1"],
  additionalProperties: false,
};

const PROMPT = (w, h, avoid) => `This is a ${w}x${h} px frame from first-person footage of walking through San Francisco. It is a round of an "I spy" game: the player gets 5 seconds to click the target.

Pick ONE target that is clearly visible in this exact frame. Prefer things that feel specifically San Francisco: a Waymo or other robotaxi (white car with a roof sensor), a billboard for an AI or tech company, a cable car, Muni bus or streetcar, a Victorian "painted lady" house, the Golden Gate Bridge, Bay Bridge, Transamerica Pyramid, Salesforce Tower, Coit Tower, a hilly street, a Chinatown lantern, a fog bank, a Muni sign. If none of those is visible, pick the most fun distinct object (a street sign, a mural, a dog, a bright storefront).

Rules:
- The target must be unambiguous: only one instance in view, or clearly the most prominent one.
- Do not pick tiny things under about 30 px across.
${avoid.length ? `- The player already found these, so pick something different if you can: ${avoid.join(", ")}.\n` : ""}- Give a tight bounding box in pixel coordinates of this image (x0,y0 top-left; x1,y1 bottom-right).
- If nothing is a fair target, set found=false and use zeros.`;

async function findTarget({ image, width, height, avoid = [] }) {
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
        { type: "text", text: PROMPT(width, height, avoid) },
      ],
    }],
  });
  if (response.stop_reason === "refusal") return { found: false };
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return { found: false };
  const r = JSON.parse(text);
  if (!r.found || r.x1 <= r.x0 || r.y1 <= r.y0) return { found: false };
  // normalise to 0..1 so the browser can map onto any display size
  return {
    found: true, label: r.label, clue: r.clue,
    box: { x0: r.x0 / width, y0: r.y0 / height, x1: r.x1 / width, y1: r.y1 / height },
  };
}

const TYPES = { ".html": "text/html; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };

function serveFile(req, res, file) {
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) { // video seeking needs range requests
    const start = range[1] ? +range[1] : 0;
    const end = range[2] ? +range[2] : stat.size - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Content-Range": `bytes ${start}-${end}/${stat.size}` });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": stat.size });
    fs.createReadStream(file).pipe(res);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, hasKey: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }));
    }
    if (req.method === "POST" && url.pathname === "/api/find") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const t0 = Date.now();
      const result = await findTarget(JSON.parse(body));
      console.log(`find ${Date.now() - t0}ms →`, result.found ? result.label : "nothing");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    }
    // only serve the page and video files from this folder
    const name = url.pathname === "/" ? "index.html" : path.basename(decodeURIComponent(url.pathname));
    const file = path.join(here, name);
    if (TYPES[path.extname(name)] && fs.existsSync(file)) return serveFile(req, res, file);
    res.writeHead(404).end("not found");
  } catch (err) {
    let msg = err?.message || String(err);
    if (err instanceof AuthenticationError) msg = "Invalid Anthropic API key. Restart the server with a valid ANTHROPIC_API_KEY.";
    else if (err instanceof RateLimitError) msg = "Rate limited by the API; try again in a moment.";
    else if (err instanceof APIConnectionError) msg = "Couldn't reach the Anthropic API.";
    else if (err instanceof APIError) msg = `API error ${err.status}: ${err.message}`;
    else if (/api.?key|credential|auth/i.test(msg)) msg = "No Anthropic API key found. Restart the server with ANTHROPIC_API_KEY set.";
    console.error(msg);
    res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: msg }));
  }
}).listen(PORT, () => console.log(`SF I-Spy → http://localhost:${PORT}`));
