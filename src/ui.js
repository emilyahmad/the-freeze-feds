import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const PIC = 192;              // close-up render size (px)
const CARD_LAYER = 1;         // the hovered person is put on this layer so the close-up shows only them

/** Hover card: renders a close-up of the hovered character with a second camera into a render target. */
export class HoverCard {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.el = $('#card'); this.text = $('#card-text');
    this.ctx = $('#card-pic').getContext('2d');
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
    this.cam.layers.set(CARD_LAYER);
    this.rt = new THREE.WebGLRenderTarget(PIC, PIC, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(PIC * PIC * 4);
    this.img = new ImageData(PIC, PIC);
    this.scratch = Object.assign(document.createElement('canvas'), { width: PIC, height: PIC });
    this.agent = null;
  }

  setLayer(agent, on) { agent?.person.traverse((o) => (on ? o.layers.enable(CARD_LAYER) : o.layers.disable(CARD_LAYER))); }

  show(agent, x, y, stageW, stageH) {
    if (agent !== this.agent || (agent && agent.frozen !== this.shownFrozen)) {
      if (agent !== this.agent) { this.setLayer(this.agent, false); this.setLayer(agent, true); }
      this.agent = agent;
      if (agent) {
        // a boss's name is only revealed once they're frozen
        this.shownFrozen = agent.frozen;
        this.text.replaceChildren();
        if (agent.frozen) this.text.append(Object.assign(document.createElement('b'), { className: 'name', textContent: `❄ ${agent.name}` }), document.createElement('br'));
        this.text.append(agent.info);
      }
    }
    if (!agent) { this.el.hidden = true; return; }
    this.el.hidden = false;
    this.el.classList.toggle('frozen', agent.frozen);
    // keep the card next to the cursor, flipping sides near the edges
    const w = this.el.offsetWidth, h = this.el.offsetHeight, gap = 22;
    const left = x + gap + w > stageW ? x - gap - w : x + gap;
    const top = Math.min(Math.max(8, y - h / 2), stageH - h - 8);
    this.el.style.left = left + 'px'; this.el.style.top = top + 'px';
    this.render();
  }

  render() {
    const p = this.agent.person, h = p.rotation.y, base = p.position;
    const tgt = new THREE.Vector3(base.x, 0.92, base.z);
    this.cam.position.set(base.x + Math.sin(h + 0.35) * 2.9, 1.3, base.z + Math.cos(h + 0.35) * 2.9);
    this.cam.lookAt(tgt);
    const r = this.renderer, prevAlpha = r.getClearAlpha(), prevColor = r.getClearColor(new THREE.Color());
    r.setRenderTarget(this.rt); r.setClearColor(0xe6dcff, 1); r.clear(); r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, PIC, PIC, this.pixels);
    r.setRenderTarget(null); r.setClearColor(prevColor, prevAlpha);
    const row = PIC * 4;                       // WebGL rows are bottom-up: flip while copying
    for (let y = 0; y < PIC; y++) this.img.data.set(this.pixels.subarray((PIC - 1 - y) * row, (PIC - y) * row), y * row);
    this.scratch.getContext('2d').putImageData(this.img, 0, 0);
    this.ctx.drawImage(this.scratch, 0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }
}

// ---- HUD, popups and screens ----
export const hud = {
  show(on) { $('#hud').hidden = !on; },
  timer(t) { const el = $('#timer'); el.textContent = `⏱ ${Math.ceil(t)}`; el.classList.toggle('low', t <= 10); },
  caught(n, of) { $('#caught').textContent = `❄ Bosses ${n} / ${of}`; },
};

export function popup(x, y, text, kind) {
  const el = Object.assign(document.createElement('div'), { className: `pop ${kind}`, textContent: text });
  el.style.left = x + 'px'; el.style.top = y + 'px';
  $('#fx').appendChild(el); setTimeout(() => el.remove(), 1200);
}

export function snowBurst(x, y) {
  for (let i = 0; i < 16; i++) {
    const el = Object.assign(document.createElement('span'), { className: 'flake', textContent: ['❄', '❅', '❆', '🧊'][i % 4] });
    $('#fx').appendChild(el);
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    el.animate([
      { transform: `translate(${x}px, ${y}px) scale(.4)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
  }
}

export function wrongFlash() {
  const f = $('#flash'), s = $('#stage');
  f.classList.remove('on'); s.classList.remove('shake'); void f.offsetWidth;
  f.classList.add('on'); s.classList.add('shake');
}

export function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }
