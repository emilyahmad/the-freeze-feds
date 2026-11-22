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
  caught(n, of) { $('#caught').textContent = `❄ CEOs ${n} / ${of}`; },
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

// ---- ID check: LinkedIn-style profile ----
const FIRST_M = ['Jun', 'Marco', 'Dev', 'Luis', 'Kenji', 'Omar', 'Theo', 'Sam', 'Ravi', 'Felix', 'Hugo', 'Malik', 'Ivan', 'Tomás', 'Ben', 'Chidi'];
const FIRST_F = ['Ana', 'Mei', 'Priya', 'Sofia', 'Hana', 'Zoe', 'Lena', 'Ines', 'Maya', 'Ruth', 'Aiko', 'Nia', 'Clara', 'Yara', 'Eva', 'Ada'];
const JOBS = ['Product Designer', 'Senior Software Engineer', 'Barista', 'ICU Nurse', 'Data Analyst', 'High School Teacher', 'UX Researcher', 'Line Cook',
  'Account Executive', 'Bike Messenger', 'Product Manager', 'Muni Operator', 'Technical Recruiter', 'Paralegal', 'Dental Hygienist', 'Content Strategist'];
const ORGS = ['Fog City Coffee', 'Cable Car Credit Union', 'UCSF Health', 'Mission Street Bakery', 'SFUSD', 'SFMTA', 'Bay Bytes', 'Nob Hill Dental',
  'Golden Gate Analytics', 'Dolores Design Co.', 'Chinatown Noodle House', 'Presidio Labs'];
const TAGS = ['Open to work', 'Dog parent 🐶', 'Building in public', 'Ultramarathoner 🏃', '#Hiring', 'Coffee snob ☕', 'Ex-startup', 'Opinions my own', 'Plant collector 🌿'];
const SCHOOLS = ['SF State University', 'UC Berkeley', 'City College of San Francisco', 'UC Davis', 'Santa Clara University', 'USF'];
const BANNERS = [['Let’s connect!', '#0a66c2', '#7fc1ff'], ['#OpenToWork', '#1b5e3b', '#57c785'], ['Coffee first ☕', '#6b3f2a', '#d79b6a'],
  ['Always learning', '#3b2a7a', '#a58bf0'], ['We’re hiring!', '#8a1f3b', '#f07a8a'], ['Golden hour 🌉', '#9a4a1a', '#f2b45a']];
// parody profiles for the bosses: hints in the headline, but no real names until they're frozen
const BOSS = {
  holmes: { head: 'Founder & CEO @ OneDrop Labs | 200 tests from a single finger-prick 🩸 | Visionary', edu: 'Stanford University (left early)', followers: '1,204,118', banner: ['Change everything. One drop.', '#5b0f14', '#c7323c'], hl: 'Celebrating 10 years of stealth mode. Results coming soon.' },
  zuckerberg: { head: 'Founder, Chairman & CEO | Building the metaverse 🥽 | Move fast', edu: 'Harvard University (dropped out)', followers: '119,800,450', banner: ['Connecting everyone 🌐', '#123a8a', '#5d8df5'], hl: 'Hosted a cage fight that never happened.' },
  huang: { head: 'Founder & CEO @ a GPU company | The more you buy, the more you save 💚', edu: 'Stanford University · Oregon State', followers: '3,450,912', banner: ['Accelerated computing ⚡', '#0d2a0d', '#76b900'], hl: 'Gave a keynote in a leather jacket (again).' },
  thiel: { head: 'Contrarian investor | Competition is for losers ♟️ | Zero to One', edu: 'Stanford Law School', followers: '2,031,555', banner: ['What do you believe that nobody else does?', '#1d1d24', '#5a5a6a'], hl: 'Paid people to drop out of college.' },
  karp: { head: 'CEO @ Seeing-Stone Analytics | PhD, Social Theory | Software that wins 🪨', edu: 'Goethe University Frankfurt · Stanford Law', followers: '812,330', banner: ['We see everything 👁️', '#121a12', '#59613f'], hl: 'Did tai chi through an earnings call.' },
  gates: { head: 'Co-chair @ a very big foundation | Retired software guy | Reading 50 books a year 📚', edu: 'Harvard University (dropped out)', followers: '36,912,004', banner: ['Clippy misses you 📎', '#0b3a6b', '#3aa0e8'], hl: 'Still answers to “have you tried turning it off and on again”.' },
  bezos: { head: 'Executive Chair @ an online bookstore 📦 | It’s always Day 1 | Rocket hobbyist', edu: 'Princeton University', followers: '8,240,661', banner: ['Your package has been delivered 📦', '#232f3e', '#ff9900'], hl: 'Went to space for 10 minutes. Thanked every customer.' },
  dimon: { head: 'Chairman & CEO @ a very large bank 🏦 | Fortress balance sheet', edu: 'Harvard Business School', followers: '5,118,207', banner: ['Too big to fail 🏛️', '#0b1f44', '#5b6d8e'], hl: 'Survived several crises (caused by other banks).' },
  buffett: { head: 'Chairman & CEO @ a holding company in Omaha | Be greedy when others are fearful 🥤', edu: 'Columbia Business School', followers: '4,690,233', banner: ['Buy and hold 🍔', '#2a1a10', '#9a2b2b'], hl: 'Celebrating 60 years at the same company.' },
};
const pickR = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmt = (n) => n.toLocaleString('en-US');

/** Made-up profile for an agent (kept on the agent so re-checking someone shows the same profile).
 *  No names on the profile: a boss's real name only shows on the FROZEN stamp. */
export function profileFor(agent) {
  if (!agent.profile) {
    const look = agent.person.userData.look, boss = BOSS[look.ceoId];
    const grand = !boss && Math.random() < 0.15;      // decoys: some normals are hustle-posting founders too
    const years = randInt(1, 9);
    agent.profile = {
      headline: boss ? boss.head : grand ? `Founder & CEO @ a stealth startup 🚀 | ${randInt(2, 4)}x founder | Disrupting ${pickR(['coffee', 'laundry', 'parking', 'burritos', 'dog walking'])}`
        : `${pickR(JOBS)} @ ${pickR(ORGS)}${Math.random() < 0.6 ? ' | ' + pickR(TAGS) : ''}`,
      edu: boss ? boss.edu : pickR(SCHOOLS),
      followers: boss ? boss.followers : fmt(grand ? randInt(8000, 40000) : randInt(40, 2400)),
      conn: boss || grand || Math.random() < 0.3 ? '500+ connections' : `${randInt(30, 480)} connections`,
      mutual: `${pickR(FIRST_F)}, ${pickR(FIRST_M)} and ${randInt(2, 60)} other mutual connections`,
      banner: boss ? boss.banner : pickR(BANNERS),
      hl: boss ? boss.hl : `Celebrating ${years} year${years > 1 ? 's' : ''} at work.`,
    };
  }
  return agent.profile;
}

export class Profile {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.el = $('#profile'); this.stampEl = $('#pf-stamp');
    this.photoCtx = $('#pf-photo').getContext('2d');
    this.W = 200; this.H = 200;
    this.cam = new THREE.PerspectiveCamera(24, this.W / this.H, 0.1, 30);
    this.cam.layers.set(CARD_LAYER);
    this.rt = new THREE.WebGLRenderTarget(this.W, this.H, { samples: 4 });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.pixels = new Uint8Array(this.W * this.H * 4);
    this.img = new ImageData(this.W, this.H);
    this.scratch = Object.assign(document.createElement('canvas'), { width: this.W, height: this.H });
    this.agent = null; this.hideTimer = 0;
  }

  open(agent) {
    clearTimeout(this.hideTimer);
    this.agent = agent;
    const p = profileFor(agent), set = (id, t) => { $(id).textContent = t; };
    set('#pf-headline', p.headline); set('#pf-edu', p.edu);
    set('#pf-followers', `${p.followers} followers`); set('#pf-conn', p.conn); set('#pf-mutual', p.mutual);
    set('#pf-about', agent.info); set('#pf-hl', p.hl);
    const [text, c0, c1] = p.banner, banner = $('#pf-banner');
    banner.textContent = text; banner.style.background = `linear-gradient(120deg, ${c0}, ${c1})`;
    this.stampEl.className = ''; this.stampEl.replaceChildren();
    this.photoCtx.fillStyle = '#e9e5f2'; this.photoCtx.fillRect(0, 0, this.W, this.H);
    this.el.classList.remove('out'); this.el.hidden = false;
    void this.el.offsetWidth;                       // restart the slide-in animation
  }

  /** Profile photo: a straight-on head-and-shoulders render of the agent, on their own layer. */
  photo() {
    const a = this.agent; if (!a) return;
    const p = a.person.position, h = a.person.rotation.y;
    this.cam.position.set(p.x + Math.sin(h) * 1.7, 1.24, p.z + Math.cos(h) * 1.7);
    this.cam.lookAt(p.x, 1.2, p.z);
    a.person.traverse((o) => o.layers.enable(CARD_LAYER));
    const r = this.renderer, prevAlpha = r.getClearAlpha(), prevColor = r.getClearColor(new THREE.Color());
    r.setRenderTarget(this.rt); r.setClearColor(0xe9e5f2, 1); r.clear(); r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.W, this.H, this.pixels);
    r.setRenderTarget(null); r.setClearColor(prevColor, prevAlpha);
    a.person.traverse((o) => o.layers.disable(CARD_LAYER));
    const row = this.W * 4;
    for (let y = 0; y < this.H; y++) this.img.data.set(this.pixels.subarray((this.H - 1 - y) * row, (this.H - y) * row), y * row);
    this.scratch.getContext('2d').putImageData(this.img, 0, 0);
    this.photoCtx.drawImage(this.scratch, 0, 0);
  }

  /** Stamp across the screen: 'frozen' (with the revealed name), 'innocent' or 'released'. */
  stamp(kind, sub) {
    this.stampEl.className = kind;
    this.stampEl.replaceChildren(document.createTextNode({ frozen: '❄ FROZEN', innocent: 'INNOCENT', released: 'RELEASED' }[kind]));
    if (sub) this.stampEl.append(Object.assign(document.createElement('small'), { textContent: sub }));
    void this.stampEl.offsetWidth; this.stampEl.classList.add('on');
  }

  close(delay = 0) {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.el.classList.add('out');
      this.hideTimer = setTimeout(() => { this.el.hidden = true; this.el.classList.remove('out'); }, 350);
    }, delay * 1000);
    this.agent = null;
  }
}
