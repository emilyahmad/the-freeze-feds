import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const CARD_LAYER = 1;         // the person being checked is put on this layer so the profile photo shows only them
const PHOTO_HEADS = 1.9;      // profile photo frame height, in head heights (smaller = tighter on the face)
const PHOTO_DROP = 0.08;      // how far below the eyes the photo is aimed, as a fraction of the frame (head sits a bit high, like a headshot)
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const PHOTO_BG_L = 0.82;       // headshot backdrop lightness: a pale tint of the top they're wearing
const PHOTO_BG_S = 0.55;       // ...with its saturation capped so bright tops still give a soft pastel

/** Headshot backdrop: a lighter shade of the top the Mii is wearing (vest, else jacket, else shirt). */
function photoBg(look = {}) {
  const top = look.outfit === 'vest' ? look.vest : look.jacket || look.shirt;
  const c = new THREE.Color(top || '#e9e5f2'), hsl = {};
  c.getHSL(hsl, THREE.SRGBColorSpace);
  return c.setHSL(hsl.h, Math.min(hsl.s, PHOTO_BG_S), PHOTO_BG_L, THREE.SRGBColorSpace);
}

// ---- HUD, popups and screens ----
export const hud = {
  show(on) { $('#hud').hidden = !on; },
  timer(t) { const el = $('#timer'); el.textContent = `⏱ ${Math.ceil(t)}`; el.classList.toggle('low', t <= 10); },
  caught(n, of) { $('#caught').textContent = `❄ Tech Execs ${n} / ${of}`; },
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

/** A snowball flies out of the street from `from` (stage px) toward the player, grows until it splats over the whole
 *  screen, sticks for a moment, then slides off the bottom like snow down a window. Used by an innocent at the ID-check
 *  spot (with `text`) and by the escaped bosses in the finale (`far`: they throw from the crosswalk, so the ball starts
 *  smaller and arcs a little). With `size` (a fraction of the screen's longer side) it splats as a round blob that big
 *  where it lands instead of covering the whole screen (the finale's volleys, all but the last ball).
 *  onImpact() fires on the splat, onDone() once it has slid off. */
const BACK_FLY = 0.5, BACK_HOLD = 0.75, BACK_SLIDE = 1.2;   // seconds: flight toward the screen, stuck on it, sliding off
export function snowBack(from, { text = '', far = false, size = 0, onImpact, onDone } = {}) {
  const stage = $('#stage'), w = stage.clientWidth, h = stage.clientHeight;
  const ball = Object.assign(document.createElement('div'), { className: 'snowball back' });
  stage.appendChild(ball);
  // perspective: depth shrinks linearly in time, so scale = s0 / depth and it rushes in faster the closer it gets
  const D = size * Math.max(w, h);                           // blob diameter (px), or 0 for the whole screen
  const s0 = far ? 0.12 : 0.45, s1 = D ? D * 0.7 / 64 : Math.hypot(w, h) / 64 * 1.3, frames = [];
  const to = D ? { x: w * (0.15 + Math.random() * 0.7), y: h * (0.2 + Math.random() * 0.45) }   // blobs land all over
    : far ? { x: w * (0.35 + Math.random() * 0.3), y: h * (0.35 + Math.random() * 0.2) } : { x: w * 0.5, y: h * 0.45 };
  const arc = far ? h * 0.08 : 0;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, depth = 1 - t * (1 - s0 / s1), k = (s0 / depth - s0) / (s1 - s0);   // k: 0 → 1 screen-space progress
    frames.push({ transform: `translate(${from.x + (to.x - from.x) * k}px, ${from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * arc}px) scale(${s0 / depth}) rotate(${-t * 240}deg)` });
  }
  ball.animate(frames, { duration: BACK_FLY * 1000, easing: 'linear', fill: 'forwards' }).onfinish = () => {
    if (!ball.isConnected) return;                           // cleared mid-flight (round restarted)
    ball.remove();
    if (D) return blob(stage, to, D, h, onImpact, onDone);
    const splat = Object.assign(document.createElement('div'), { className: 'splat' });
    const body = Object.assign(document.createElement('div'), { className: 'splat-body' });
    const trail = Object.assign(document.createElement('div'), { className: 'splat-trail' });
    const stops = []; for (let x = 0; x < 100;) {            // uneven wet streaks left on the "glass" above it
      const a = (Math.random() ** 2 * 0.45).toFixed(2), x2 = Math.min(100, x + 0.6 + Math.random() * 3.5);
      stops.push(`rgba(235, 248, 255, ${a}) ${x.toFixed(1)}% ${x2.toFixed(1)}%`); x = x2;
    }
    trail.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
    splat.append(trail, body);
    for (let i = 0, n = 13; i < n; i++) {                    // lumpy top edge (shows as it slides down)
      const s = 10 + Math.random() * 14;
      body.appendChild(Object.assign(document.createElement('span'), { className: 'splat-lump' }))
        .style.cssText = `width:${s}vmax;height:${s}vmax;left:${-6 + i / (n - 1) * 112 - s / 2}%;top:${-s * (0.3 + Math.random() * 0.25)}vmax`;
    }
    for (let i = 0; i < 9; i++) {                            // soft shaded clumps so it reads as packed snow
      const s = 14 + Math.random() * 26;
      body.appendChild(Object.assign(document.createElement('span'), { className: 'splat-clump' }))
        .style.cssText = `width:${s}vmax;height:${s}vmax;left:${Math.random() * 100 - s / 2}%;top:${Math.random() * 90}%`;
    }
    if (text) body.appendChild(Object.assign(document.createElement('div'), { className: 'splat-text', textContent: text }));
    stage.appendChild(splat);
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
    onImpact?.();
    const total = 120 + BACK_HOLD * 1000 + BACK_SLIDE * 1000, at = (ms) => ms / total;
    splat.animate([
      { transform: 'translateY(0) scale(1.12)', opacity: 0.6, offset: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: at(120) },
      { transform: 'translateY(0) scale(1)', offset: at(120 + BACK_HOLD * 1000), easing: 'cubic-bezier(.55, 0, .85, .45)' },
      { transform: 'translateY(4%) scale(1)', offset: at(120 + BACK_HOLD * 1000 + 300), easing: 'cubic-bezier(.4, 0, .9, .6)' },
      { transform: 'translateY(125%) scale(1)', offset: 1 },
    ], { duration: total, fill: 'forwards' }).onfinish = () => { splat.remove(); onDone?.(); };
  };
}

/** A partial splat: a lumpy round blob of snow `D` px across centred on `at`, which sticks, then slides off the bottom. */
function blob(stage, at, D, h, onImpact, onDone) {
  const splat = Object.assign(document.createElement('div'), { className: 'splat blob' });
  splat.style.cssText = `left:${at.x - D / 2}px;top:${at.y - D / 2}px;width:${D}px;height:${D}px`;
  const body = Object.assign(document.createElement('div'), { className: 'splat-body' });
  const trail = Object.assign(document.createElement('div'), { className: 'splat-trail' });
  trail.style.background = 'linear-gradient(90deg, transparent 12%, rgba(235, 248, 255, .3) 25% 32%, transparent 38% 55%, rgba(235, 248, 255, .35) 60% 66%, transparent 74%)';
  splat.append(trail, body);
  for (let i = 0, n = 11; i < n; i++) {                      // lumps around the rim
    const a = (i + Math.random() * 0.5) / n * Math.PI * 2, s = 22 + Math.random() * 20, r = 44 + Math.random() * 6;
    body.appendChild(Object.assign(document.createElement('span'), { className: 'splat-lump' }))
      .style.cssText = `width:${s}%;height:${s}%;left:${50 + Math.cos(a) * r - s / 2}%;top:${50 + Math.sin(a) * r - s / 2}%`;
  }
  for (let i = 0; i < 5; i++) {                              // flecks thrown off the edge
    const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 7, r = 60 + Math.random() * 14;
    body.appendChild(Object.assign(document.createElement('span'), { className: 'splat-lump' }))
      .style.cssText = `width:${s}%;height:${s}%;left:${50 + Math.cos(a) * r - s / 2}%;top:${50 + Math.sin(a) * r - s / 2}%`;
  }
  for (let i = 0; i < 4; i++) {                              // soft shaded clumps
    const s = 30 + Math.random() * 30;
    body.appendChild(Object.assign(document.createElement('span'), { className: 'splat-clump' }))
      .style.cssText = `width:${s}%;height:${s}%;left:${20 + Math.random() * 60 - s / 2}%;top:${25 + Math.random() * 50}%`;
  }
  stage.appendChild(splat);
  onImpact?.();
  const drop = h - at.y + D, total = 120 + BACK_HOLD * 1000 + BACK_SLIDE * 1000, t = (ms) => ms / total;
  splat.animate([
    { transform: 'translateY(0) scale(.6)', opacity: 0.7, offset: 0 },
    { transform: 'translateY(0) scale(1)', opacity: 1, offset: t(120) },
    { transform: 'translateY(0) scale(1)', offset: t(120 + BACK_HOLD * 1000), easing: 'cubic-bezier(.55, 0, .85, .45)' },
    { transform: `translateY(${D * 0.06}px) scale(1, 1.04)`, offset: t(120 + BACK_HOLD * 1000 + 300), easing: 'cubic-bezier(.4, 0, .9, .6)' },
    { transform: `translateY(${drop}px) scale(1, 1.04)`, offset: 1 },
  ], { duration: total, fill: 'forwards' }).onfinish = () => { splat.remove(); onDone?.(); };
}

/** Drop every snowball in flight or splatted on the screen at once (round restarted / mode stopped). */
export function clearSplats() {
  for (const el of document.querySelectorAll('.splat, .snowball.back')) el.remove();
}

export function wrongFlash() {
  const f = $('#flash'), s = $('#stage');
  f.classList.remove('on'); s.classList.remove('shake'); void f.offsetWidth;
  f.classList.add('on'); s.classList.add('shake');
}

export function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; }

// ---- ID check: LinkedIn-style profile ----
// Every list is drawn from a per-round deck (resetProfileDeck(), called when the crowd resets), so no two
// profiles in a round share a headline, school, banner, highlight or mutual connection. The pools are kept
// disjoint from each other and from the bosses' fixed text, so a decoy never repeats a boss word for word.
const FIRST_M = ['Jun', 'Marco', 'Dev', 'Luis', 'Kenji', 'Omar', 'Theo', 'Sam', 'Ravi', 'Felix', 'Hugo', 'Malik', 'Ivan', 'Tomás', 'Ben', 'Chidi',
  'Arjun', 'Pablo', 'Yusuf', 'Leo', 'Kwame', 'Diego', 'Hiro', 'Nate',
  'Mateo', 'Andre', 'Sven', 'Rafael', 'Kofi', 'Elijah', 'Tariq', 'Wen', 'Callum', 'Idris'];
const FIRST_F = ['Ana', 'Mei', 'Priya', 'Sofia', 'Hana', 'Zoe', 'Lena', 'Ines', 'Maya', 'Ruth', 'Aiko', 'Nia', 'Clara', 'Yara', 'Eva', 'Ada',
  'Leila', 'Rosa', 'Tess', 'Amara', 'Jia', 'Noor', 'Gwen', 'Paloma',
  'Fatima', 'Ingrid', 'Keiko', 'Lucia', 'Simone', 'Thandi', 'Bea', 'Marisol', 'Nadia', 'Ottilie'];
// Ordinary normals are cracked engineers and researchers: impressive tech jobs at made-up companies
const JOBS = ['Staff Software Engineer', 'Founding Engineer', 'Research Scientist', 'Principal ML Engineer', 'Kernel Engineer', 'Compiler Engineer',
  'Distributed Systems Engineer', 'Member of Technical Staff', 'Robotics Engineer', 'Security Researcher', 'Quant Developer', 'Infra Lead',
  'Head of Applied AI', 'Chip Design Engineer', 'Rust Core Contributor', 'Site Reliability Lead', 'Computer Vision Lead', 'Database Internals Engineer',
  'Inference Optimization Lead', 'Cryptography Engineer', 'Product Engineer', 'Autonomy Engineer', 'Founding Designer', 'Graphics Programmer'];
const ORGS = ['Bay Bytes', 'Presidio Labs', 'SoMa Signal Labs', 'Golden Gate Compute', 'Twin Peaks Robotics', 'Fogline AI', 'Mission Silicon',
  'Embarcadero Systems', 'Nob Hill Quant', 'Haight Labs', 'Dogpatch Dynamics', 'Potrero Photonics', 'Sutro Security', 'Marina ML',
  'Castro Cloud', 'Russian Hill Research', 'Bernal Kernel Co.', 'Ocean Beach Orbital', 'Hayes Valley Hardware', 'Lands End Labs',
  'Excelsior Inference', 'Cable Car Compute', 'Alamo Square AI', 'Treasure Island Thermonuclear'];
const TAGS = ['IOI gold 🥇', 'ICPC World Finalist', 'NeurIPS oral ×2', 'Top 1% on Kaggle', '10k⭐ on GitHub', 'Ex-founding team (acquired)',
  'Wrote the paper everyone cites', 'Shipped at 16', 'Putnam top 25', 'Linux kernel maintainer', 'IMO silver', 'Speedran a PhD in 3 years',
  '#1 on Hacker News (4×)', 'Built a CPU in Minecraft', 'Reverse-engineered my car’s firmware', 'Codeforces Legendary Grandmaster',
  'Hiring cracked engineers', '0 → 1 → 100M users', 'Patents: 11', 'Self-taught at 12', 'DEF CON CTF winner', 'Open-source maintainer (40M downloads)',
  'Two-time Olympiad coach', 'Wrote my own OS for fun'];
const SCHOOLS = ['MIT', 'Caltech', 'Carnegie Mellon University', 'UC Berkeley (EECS)', 'University of Waterloo', 'Georgia Tech', 'ETH Zürich',
  'University of Toronto', 'IIT Bombay', 'Tsinghua University', 'University of Cambridge', 'Cornell University', 'University of Illinois Urbana-Champaign',
  'Princeton University (PhD)', 'University of Oxford', 'EPFL', 'University of Michigan', 'KAIST', 'Technion', 'University of Washington (Allen School)',
  'UT Austin', 'Imperial College London', 'Harvey Mudd College', 'Seoul National University'];
const BANNERS = [['Ship it 🚢', '#0a66c2', '#7fc1ff'], ['Scaling laws enjoyer 📈', '#1b5e3b', '#57c785'], ['Compile, run, repeat ⚙️', '#3a3a3a', '#b0b0b0'],
  ['Attention is all I need 🧠', '#3b2a7a', '#a58bf0'], ['We’re hiring cracked engineers', '#8a1f3b', '#f07a8a'], ['p99 under 5ms ⚡', '#0a3a5a', '#5ac0e0'],
  ['sudo make it happen', '#1a1a1a', '#5af07a'], ['O(1) or bust', '#2a3a7a', '#7fa0f0'], ['Zero-downtime deploys only', '#1f4a2a', '#8fd19e'],
  ['Hello, world 👋', '#4a1a4a', '#d07ad0'], ['git push --force (with lease)', '#5a3a1a', '#e0b07a'], ['Train big, ship small 🤖', '#2a4a3a', '#7ac0a0'],
  ['Memory safe & proud 🦀', '#7a3a10', '#f2a65a'], ['Tokens per second 🔥', '#5a1a1a', '#e07a5a'], ['First-principles everything', '#1a3a4a', '#6ab0d0'],
  ['10 GPUs, 1 dream', '#0a2a1a', '#5ad08a'], ['Build. Measure. Scale.', '#3a2a1a', '#d0a070'], ['Latency is a feature', '#1a2a5a', '#90a0f0'],
  ['Open source forever 💛', '#4a3a0a', '#e0c050'], ['Robots, but nice 🦾', '#2a3a4a', '#c0d0e0'], ['Merge conflicts fear me', '#5a1a3a', '#f090b0'],
  ['Bits to atoms 🔩', '#2a2a4a', '#9090d0'], ['Nights & weekends shipping', '#5a3a1a', '#f0c080'], ['Benchmarks don’t lie 📊', '#0a3a3a', '#3af0e0']];
const HUSTLE_BANNERS = [['Building in stealth 🥷', '#111111', '#7a7a8a'], ['Series A in 9 days 💸', '#2a0a4a', '#c07af0'], ['$0 → $10M ARR', '#0a3a1a', '#5af07a'],
  ['YC W-something 🟧', '#3b2a7a', '#ff9900'], ['Default alive ✅', '#0a2a4a', '#f0d05a'], ['We’re so back 🚀', '#1a1a1a', '#f2c14e'],
  ['Profitable since month 3', '#4a0a0a', '#f05a5a'], ['Hiring founding engineers', '#0a0a3a', '#5a7af0'], ['Compute-rich, sleep-poor', '#3a2a0a', '#f0a03a'],
  ['Acquired. Building again.', '#0a3a3a', '#3af0e0'], ['Hard tech only 🛰️', '#2a0a2a', '#f05af0'], ['Ramen profitable 🍜', '#1a1a2a', '#a0a0f0'],
  ['Category creator 🦄', '#3a0a3a', '#f0a0f0'], ['Shipping daily since day 1', '#0a0a2a', '#d0d0f0']];
// parody profiles for the bosses: hints in the headline, but no real names until they're frozen
const BOSS = {
  holmes: { head: 'Founder & CEO @ OneDrop Labs | 200 tests from a single finger-prick 🩸 | Visionary', edu: 'Stanford University (left early)', followers: '1,204,118', banner: ['Change everything. One drop.', '#5b0f14', '#c7323c'], hl: 'Celebrating 10 years of stealth mode. Results coming soon.' },
  zuckerberg: { head: 'Founder, Chairman & CEO | Building the metaverse 🥽 | Move fast', edu: 'Harvard University (dropped out)', followers: '119,800,450', banner: ['Connecting everyone 🌐', '#123a8a', '#5d8df5'], hl: 'Hosted a cage fight that never happened.' },
  huang: { head: 'Founder & CEO @ a GPU company | The more you buy, the more you save 💚', edu: 'Stanford University · Oregon State', followers: '3,450,912', banner: ['Accelerated computing ⚡', '#0d2a0d', '#76b900'], hl: 'Gave a keynote in a leather jacket (again).' },
  thiel: { head: 'Contrarian investor | Competition is for losers ♟️ | Zero to One', edu: 'Stanford Law School', followers: '2,031,555', banner: ['What do you believe that nobody else does?', '#1d1d24', '#5a5a6a'], hl: 'Paid people to drop out of college.' },
  karp: { head: 'CEO @ Seeing-Stone Analytics | PhD, Social Theory | Software that wins 🪨', edu: 'Goethe University Frankfurt · Stanford Law', followers: '812,330', banner: ['We see everything 👁️', '#121a12', '#59613f'], hl: 'Did tai chi through an earnings call.' },
  gates: { head: 'Co-chair @ a very big foundation | Retired software guy | Reading 50 books a year 📚', edu: 'Harvard University (left to start a company)', followers: '36,912,004', banner: ['Clippy misses you 📎', '#0b3a6b', '#3aa0e8'], hl: 'Still answers to “have you tried turning it off and on again”.' },
  bezos: { head: 'Executive Chair @ an online bookstore 📦 | It’s always Day 1 | Rocket hobbyist', edu: 'Princeton University', followers: '8,240,661', banner: ['Your package has been delivered 📦', '#232f3e', '#ff9900'], hl: 'Went to space for 10 minutes. Thanked every customer.' },
  dimon: { head: 'Chairman & CEO @ a very large bank 🏦 | Fortress balance sheet', edu: 'Harvard Business School', followers: '5,118,207', banner: ['Too big to fail 🏛️', '#0b1f44', '#5b6d8e'], hl: 'Survived several crises (caused by other banks).' },
  buffett: { head: 'Chairman & CEO @ a holding company in Omaha | Be greedy when others are fearful 🥤', edu: 'Columbia Business School', followers: '4,690,233', banner: ['Buy and hold 🍔', '#2a1a10', '#9a2b2b'], hl: 'Celebrating 60 years at the same company.' },
};
const DEGREES = ['BS, Computer Science', 'MS, Computer Science', 'PhD, Machine Learning', 'BS, Electrical Engineering', 'MEng, EECS',
  'BS, Mathematics', 'PhD, Physics', 'BS, Mechanical Engineering', 'MS, Robotics', 'BA, Computer Science'];
const pickR = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmt = (n) => n.toLocaleString('en-US');

// Decoy profiles for normal people: each one echoes a boss's hints (blood, headsets, GPUs, contrarianism,
// foundations, packages, banks, Omaha…) so the profile alone can't be trusted, but never copies a boss's
// text or another decoy's. Followers are [min, max].
const DECOYS = [
  // OneDrop-ish
  { head: 'Founder & CEO @ Capillary Bio | Lab-on-a-chip blood panels 🩸 | Ex-Stanford bioengineering', edu: 'Stanford Bioengineering (PhD)', followers: [6000, 30000], banner: ['Every drop, sequenced 🩸', '#5b0f14', '#c7323c'], hl: 'Got FDA breakthrough designation for a 30-marker microfluidic panel.' },
  { head: 'Microfluidics Engineer @ Mission Silicon | 1,000 assays on a postage stamp 🧪', edu: 'Johns Hopkins (Biomedical Engineering)', followers: [1500, 9000], banner: ['Tiny volumes, huge data', '#1d1d24', '#c7323c'], hl: 'Published in Nature at 24. Validated it in 3 independent labs.' },
  // metaverse-ish
  { head: 'XR Graphics Lead @ Haight Labs | Rendering at 120 fps per eye 🥽', edu: 'University of Utah (Graphics)', followers: [2000, 14000], banner: ['Presence is a frame budget 🥽', '#123a8a', '#5d8df5'], hl: 'Cut headset motion-to-photon latency to 9 ms.' },
  { head: 'Founder @ a social VR startup (2M MAU) | BJJ purple belt 🥋 | Moving fast', edu: 'Harvard (CS, left junior year)', followers: [8000, 40000], banner: ['Everyone, connected 🌐', '#123a8a', '#3b2a7a'], hl: 'Scaled from dorm room to 2M monthly users in 14 months.' },
  // GPU-ish
  { head: 'CUDA Kernel Engineer | Made attention 3× faster 💚 | The more you fuse, the more you save', edu: 'Oregon State University (ECE)', followers: [3000, 20000], banner: ['Kernels go brrr ⚡', '#0d2a0d', '#76b900'], hl: 'Wrote a fused kernel now running on half the world’s inference clusters.' },
  { head: 'GPU Cluster Architect @ Golden Gate Compute | 100k accelerators, zero downtime 🖥️', edu: 'National Taiwan University', followers: [2500, 12000], banner: ['Accelerate everything 💚', '#2a1a10', '#76b900'], hl: 'Brought a 100k-GPU cluster online in 41 days. Wore a leather jacket to the launch.' },
  // contrarian / Zero-to-One-ish
  { head: 'Contrarian seed investor ♟️ | Backed 3 unicorns before Series A', edu: 'Stanford (Philosophy)', followers: [10000, 60000], banner: ['Monopolies, not competition ♟️', '#1d1d24', '#5a5a6a'], hl: 'Dropped out at 19 with a fellowship. Now has two exits.' },
  { head: 'Chess engine author | 3500 Elo bot in 2k lines of C ♟️ | Zero to one', edu: 'Stanford Law School (JD/MS CS)', followers: [1200, 8000], banner: ['Search deeper ♟️', '#1d1d24', '#6b3f2a'], hl: 'My engine beat the reigning champion engine at the TCEC superfinal.' },
  // seeing-stone-ish
  { head: 'Data Fusion Lead @ Sutro Security | PhD, Social Theory → ML 🪨 | Ontologies at scale', edu: 'Goethe University Frankfurt (PhD)', followers: [2000, 10000], banner: ['One graph to see it all 🪨', '#121a12', '#59613f'], hl: 'Built an ontology serving 40 agencies in real time.' },
  { head: 'Forward Deployed Engineer | Ships to the field in 72 hours 👁️ | Tai chi daily', edu: 'West Point (Computer Science)', followers: [800, 5000], banner: ['Deployed, not demoed 👁️', '#121a12', '#2f3e5c'], hl: 'Shipped a sensor-fusion pipeline from a tent with no Wi-Fi.' },
  // foundation / reading-ish
  { head: 'Global Health ML Lead @ a big philanthropy | Malaria forecasting 🦟 | Reads 60 books a year', edu: 'Harvard (Applied Math, dropped out)', followers: [5000, 25000], banner: ['Code that saves lives 📚', '#0b3a6b', '#3aa0e8'], hl: 'Our model routed bed nets to 12M people a season ahead.' },
  { head: 'OS Kernel Veteran → OS Researcher 💻 | Wrote my first compiler at 13', edu: 'University of Washington (PhD, OS)', followers: [3000, 15000], banner: ['Blue screens, never again 🔁', '#0b3a6b', '#5d8df5'], hl: 'Shipped a scheduler fix now running on a billion PCs.' },
  // bookstore / packages-ish
  { head: 'Logistics Optimization Lead | Same-day delivery for 40M packages 📦 | Always Day 1', edu: 'Princeton (Operations Research)', followers: [2500, 14000], banner: ['Routes solved, boxes moved 🚚', '#232f3e', '#ff9900'], hl: 'Cut last-mile cost 23% with a solver I wrote over a weekend.' },
  { head: 'Propulsion Engineer @ Ocean Beach Orbital 🚀 | Reusable boosters | Bald by choice', edu: 'Purdue (Aerospace)', followers: [4000, 22000], banner: ['Land it, fly it again 🚀', '#232f3e', '#9a4a1a'], hl: 'Designed the engine on our first booster to land and refly.' },
  // bank-ish
  { head: 'Head of Quant Risk @ a very large bank 🏦 | Stress-testing the fortress', edu: 'Harvard Business School (MBA) · MIT (Math)', followers: [3000, 16000], banner: ['Risk-adjusted everything 🏛️', '#0b1f44', '#5b6d8e'], hl: 'My model flagged the 2023 regional-bank run three weeks early.' },
  { head: 'Low-latency Trading Engineer | FPGA order books in 80 ns 🏦', edu: 'Columbia (Financial Engineering)', followers: [1500, 9000], banner: ['Nanoseconds are money 💹', '#0b1f44', '#f07a8a'], hl: 'Shaved 300 ns off the order path. Bonus had more zeros than the latency.' },
  // Omaha-ish
  { head: 'Value investor in deep tech | Omaha born 🌽 | Compounding at 31% since 2014', edu: 'Creighton University (Finance) · CFA', followers: [7000, 35000], banner: ['Moats, measured 🌽', '#2a1a10', '#9a2b2b'], hl: 'Bought a chip-tooling stock at 4× earnings. It 40×’d.' },
  { head: 'Founder @ a fintech for Main Street investors 🥤 | Never misses the annual meeting in Omaha', edu: 'University of Nebraska–Lincoln (CS)', followers: [4000, 20000], banner: ['Long-term greedy 🍔', '#9a2b2b', '#f2b45a'], hl: 'Hit 1M funded accounts without spending a dollar on ads.' },
];
// Cracked founders: absurdly impressive, but harmless
const HUSTLE = [
  'Founder & CEO @ Fogline AI | 2× founder (1 exit) | Building agents that write agents 🤖',
  'Co-founder & CTO @ Dogpatch Dynamics | Humanoid robots in 400 warehouses 🦾',
  'Founder @ Potrero Photonics | Optical interconnects for AI clusters | $120M Series B',
  'CEO @ Sutro Security | Raised a $30M seed at 21 | Ex-IOI gold',
  'Founder @ Mission Silicon | Taped out a 3nm chip with 11 people 🔬',
  'Solo founder | $4M ARR, 0 employees, 1 laptop 💻',
  'Founder @ Lands End Labs | Fusion-powered data centers ⚛️ | Hiring physicists',
  'Co-founder @ Castro Cloud | Serverless GPUs, 50k customers ☁️ | YC alum',
  'Founder & CEO @ Alamo Square AI | 1B tokens/day, profitable 📈',
  'Founder @ Nob Hill Quant | Turned a Discord bot into a $200M fund',
  '3× founder, 2 exits | Now building orbital manufacturing 🛰️',
  'Founder @ Bernal Kernel Co. | Rewrote the Linux network stack in Rust 🦀 | $45M raised',
  'CEO @ Excelsior Inference | Inference chips 10× cheaper per token ⚡',
  'Founder @ Hayes Valley Hardware | Brain-computer interfaces, FDA cleared 🧠',
];
const HUSTLE_EDU = ['Stanford (CS, dropped out)', 'MIT (left to found)', 'Y Combinator', 'Waterloo (co-op ×6, then left)', 'Caltech (Physics PhD, ABD)',
  'CMU (dropped out sophomore year)', 'Berkeley (EECS, 2 years)', 'Self-taught · IOI team', 'Oxford (Rhodes Scholar)', 'Cambridge (Part III Maths)',
  'Princeton (dropped out to build)', 'Georgia Tech (BS in 2 years)', 'Homeschooled · arXiv at 15', 'South Park Commons'];
const HUSTLE_HL = ['Raised a $50M Series A on a 4-slide deck.', 'Hit $1M ARR 63 days after launch.', 'Acquired for nine figures. Back to building the next day.',
  'Shipped v1 in a weekend. Signed 3 Fortune 500s on Monday.', 'Named to Forbes 30 Under 30 (at 22).', 'Grew from 0 to 5M users with no marketing spend.',
  'Open-sourced our core. 80k GitHub stars in a month.', 'Turned down a $1B acquisition offer.', 'Profitable in month 4. Never raised again.',
  'Hired 40 engineers, all ex-olympiad.', 'Landed a booster on the first try.', 'Our chip came back from the fab working on first silicon.',
  'Closed the round in 48 hours, 9× oversubscribed.', 'Gave the opening keynote at the biggest AI conference of the year.'];
// Ordinary normals get impressive highlights
const HL = ['Celebrating {y} at a company I joined as employee #4.', 'Promoted twice in 18 months.', 'My PR cut our cloud bill by $3M a year.',
  'Rewrote the build system. CI went from 40 min to 90 s.', 'Paper accepted as a NeurIPS oral.', 'Took our p99 latency from 900 ms to 12 ms.',
  'Found a zero-day in a major browser. Got a $250k bounty.', 'Trained a model that beat the state of the art on 7 benchmarks.',
  'Migrated 2 PB to a new database with zero downtime.', 'Shipped a feature used by 300M people.', 'Won the company hackathon 3 years running.',
  'Invited to speak at the biggest systems conference.', 'Our open-source library crossed 1M weekly downloads.', 'Built the robot arm’s control stack from scratch.',
  'Designed the cache that serves 40M requests a second.', 'Filed 3 patents this year.', 'Got a 4-line patch merged into the Linux kernel.',
  'Solved a 20-year-old open problem in compilers.', 'Taught a robot to fold laundry. Finally.', 'Optimized inference 6× on the same hardware.',
  'Mentored 12 interns, all got return offers.', 'Hit #1 on Hacker News with a weekend project.', 'Led the team that taped out our first chip.',
  'Recognized as a Top Engineer at a 10,000-person company.'];

// per-round deck: draw() hands out each entry of a list at most once until resetProfileDeck() (or until it runs dry)
let used = new Map();
export function resetProfileDeck() { used = new Map(); }
const usedFor = (list) => { if (!used.has(list)) used.set(list, new Set()); return used.get(list); };
const hasLeft = (list) => usedFor(list).size < list.length;
function draw(list) {
  const u = usedFor(list);
  if (u.size >= list.length) u.clear();
  const free = list.filter((x) => !u.has(x)), x = pickR(free);
  u.add(x); return x;
}

/** Made-up profile for an agent (kept on the agent so re-checking someone shows the same profile).
 *  No names on the profile: a boss's real name only shows on the FROZEN stamp.
 *  Normals: ~40% are decoys that echo a boss's hints, ~20% cracked founders, the rest cracked engineers. */
export function profileFor(agent) {
  if (!agent.profile) {
    const look = agent.person.userData.look, boss = BOSS[look.ceoId];
    const roll = Math.random();
    const decoy = !boss && roll < 0.4 && hasLeft(DECOYS) && draw(DECOYS);
    const grand = !boss && !decoy && roll < 0.6 && hasLeft(HUSTLE);
    const years = randInt(1, 9), job = !boss && !decoy && !grand ? draw(JOBS) : '';
    const big = boss || grand || (decoy && decoy.followers[1] > 3000);
    agent.profile = boss ? {
      headline: boss.head, edu: boss.edu, followers: boss.followers, banner: boss.banner, hl: boss.hl,
      conn: '500+ connections',
    } : decoy ? {
      headline: decoy.head, edu: decoy.edu, followers: fmt(randInt(...decoy.followers)), banner: decoy.banner, hl: decoy.hl,
    } : grand ? {
      headline: draw(HUSTLE), edu: draw(HUSTLE_EDU),
      followers: fmt(randInt(20000, 250000)), banner: draw(HUSTLE_BANNERS), hl: draw(HUSTLE_HL),
    } : {
      headline: `${job} @ ${draw(ORGS)}${Math.random() < 0.6 ? ' | ' + draw(TAGS) : ''}`, edu: draw(SCHOOLS),
      followers: fmt(randInt(800, 15000)), banner: draw(BANNERS),
      hl: draw(HL).replace('{y}', `${years} year${years > 1 ? 's' : ''}`).replace('{job}', job),
    };
    agent.profile.since = 2026 - randInt(boss ? 8 : 0, boss ? 30 : 7);
    agent.profile.grad = Math.min(agent.profile.since, 2026) - randInt(0, 6);
    agent.profile.degree = pickR(DEGREES);
    agent.profile.conn ??= big || Math.random() < 0.3 ? '500+ connections' : `${randInt(30, 480)} connections`;
    agent.profile.mutual = `${draw(FIRST_F)}, ${draw(FIRST_M)} and ${randInt(2, 60)} other mutual connections`;
  }
  return agent.profile;
}

/** Mouse drag-to-scroll on the phone (touch and wheel scroll natively). Pointer events stop here so dragging
 *  or clicking the phone never reaches the street underneath (which would release the person being checked). */
function dragScroll(el) {
  let y0 = 0, top0 = 0, id = null;
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.pointerType !== 'mouse') return;
    id = e.pointerId; y0 = e.clientY; top0 = el.scrollTop; el.setPointerCapture(id); el.classList.add('drag');
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) el.scrollTop = top0 - (e.clientY - y0); });
  const end = (e) => { if (e.pointerId === id) { id = null; el.classList.remove('drag'); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
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
    this.scroller = $('.ph-scroll'); dragScroll(this.scroller);
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
    // Experience / Education, below the fold: read off the headline and school so they always agree with them
    const [title, org] = p.headline.split(' | ')[0].split(' @ ');
    set('#pf-xp-title', title); set('#pf-xp-org', org ? `${org} · Full-time` : 'Self-employed');
    set('#pf-xp-time', `${p.since} – Present · ${2026 - p.since || 1} yr${2026 - p.since > 1 ? 's' : ''}`);
    const logo = $('#pf-xp-logo');
    logo.textContent = (org || title).replace(/^(an?|the)\s+/i, '')[0].toUpperCase(); logo.style.background = c1;
    const [first, second] = p.edu.split(' · '), [, school, paren] = first.match(/^(.*?)(?:\s*\((.*)\))?$/);
    const note = paren || (!/universit|college|institute|school/i.test(second ?? 'school') && second);   // "Self-taught · IOI team"
    set('#pf-ed-school', school); set('#pf-ed-deg', note ? note[0].toUpperCase() + note.slice(1) : p.degree);
    set('#pf-ed-time', `${p.grad - 4} – ${p.grad}`); set('#pf-ed-logo', school[0]);
    this.scroller.scrollTop = 0;
    this.tick();
    this.stampEl.className = ''; this.stampEl.replaceChildren();
    this.bg = photoBg(agent.person.userData.look);
    this.photoCtx.fillStyle = `#${this.bg.getHexString()}`; this.photoCtx.fillRect(0, 0, this.W, this.H);
    this.el.classList.remove('out'); this.el.hidden = false;
    void this.el.offsetWidth;                       // restart the slide-in animation
  }

  /** Status-bar clock: the real local time, iPhone style (no AM/PM, no leading zero). Kept ticking while the phone is up. */
  tick() {
    clearTimeout(this.clockTimer);
    const now = new Date(), h = now.getHours() % 12 || 12;
    $('#pf-clock').textContent = `${h}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (this.agent) this.clockTimer = setTimeout(() => this.tick(), 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
  }

  /** Profile photo: a straight-on head-and-shoulders render of the agent, on their own layer.
   *  Framed on the agent's actual head (so kids, tall heads and broad faces all sit centred), not a fixed height. */
  photo() {
    const a = this.agent; if (!a) return;
    const { headFrame, eyeY } = a.person.userData, h = a.person.rotation.y;
    a.person.updateMatrixWorld(true);
    const eye = headFrame.localToWorld(_v.set(0, eyeY, 0));                 // eye line, mid-head
    const headH = eye.distanceTo(headFrame.localToWorld(_w.set(0, 0, 0))) * 2;   // neck → crown, in metres
    const viewH = headH * PHOTO_HEADS;                                       // frame height, in heads
    const dist = viewH / 2 / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    const aim = eye.clone(); aim.y -= viewH * PHOTO_DROP;                    // aim a little below the eyes: head high, shoulders below
    this.cam.position.set(aim.x + Math.sin(h) * dist, aim.y + dist * 0.03, aim.z + Math.cos(h) * dist);
    this.cam.lookAt(aim);
    a.person.traverse((o) => o.layers.enable(CARD_LAYER));
    const r = this.renderer, prevAlpha = r.getClearAlpha(), prevColor = r.getClearColor(new THREE.Color());
    r.setRenderTarget(this.rt); r.setClearColor(this.bg, 1); r.clear(); r.render(this.scene, this.cam);
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
      this.hideTimer = setTimeout(() => { this.el.hidden = true; this.el.classList.remove('out'); }, 200);
    }, delay * 1000);
    this.agent = null;
  }
}

