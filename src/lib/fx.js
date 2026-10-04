// Lightweight additive particle system: sparks, dust, shockwave rings,
// lens flares and comet trails. The loop sleeps whenever nothing is alive.

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function sprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, `rgba(${rgb},0.9)`);
  gr.addColorStop(0.55, `rgba(${rgb},0.22)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

const PALETTE = {
  white: '255,255,255',
  ice: '205,222,255',
  blue: '90,140,255',
  red: '255,40,80',
  navy: '40,80,190',
};

export class FX {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.rings = [];
    this.flares = [];
    this.emitters = [];
    this.running = false;
    this.speed = 1; // physics time scale (the short logo intro runs it faster)
    this.sprites = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, sprite(v)]));
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.W = innerWidth;
    this.H = innerHeight;
    this.c.width = Math.round(this.W * this.dpr);
    this.c.height = Math.round(this.H * this.dpr);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  burst(x, y, { count = 40, speed = [120, 520], life = [0.5, 1.2], size = [1, 2.6], colors = ['white', 'ice', 'blue', 'red'], gravity = 220, drag = 2.2, angle = 0, spread = Math.PI * 2, glow = 0.6 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = rand(speed[0], speed[1]);
      const l = rand(life[0], life[1]);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: rand(size[0], size[1]), color: pick(colors), gravity, drag, glow });
    }
    this.start();
  }

  /** dust kicked out along an edge (e.g. when a piece lands) */
  dust(x, y, w, { count = 30, colors = ['ice', 'blue', 'white'] } = {}) {
    for (let i = 0; i < count; i++) {
      const px = x + (Math.random() - 0.5) * w;
      const dir = px < x ? Math.PI : 0;
      const a = dir + (Math.random() - 0.5) * 0.9 - Math.PI * 0.08;
      const v = rand(60, 260);
      const l = rand(0.4, 0.9);
      this.parts.push({ x: px, y: y + rand(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: l, max: l, size: rand(0.8, 2), color: pick(colors), gravity: 120, drag: 3, glow: 0.5 });
    }
    this.start();
  }

  ring(x, y, { radius = 320, life = 0.9, width = 2.5, color = '255,255,255', alpha = 0.7 } = {}) {
    this.rings.push({ x, y, radius, life, max: life, width, color, alpha });
    this.start();
  }

  flare(x, y, { size = 90, life = 1.1, rot = 0, color = '220,232,255' } = {}) {
    this.flares.push({ x, y, size, life, max: life, rot, color });
    this.start();
  }

  /** follow a moving point, shedding glowing particles */
  clear() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.flares.length = 0;
    this.emitters.length = 0;
  }

  trail(getPos, duration, { color = 'ice', rate = 90, size = [1, 2.4] } = {}) {
    this.emitters.push({ getPos, until: performance.now() + duration * 1000, acc: 0, color, rate, size, prev: null });
    this.start();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000) * this.speed;
    this.last = now;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';

    // emitters
    this.emitters = this.emitters.filter((e) => {
      if (now > e.until) return false;
      const p = e.getPos();
      if (!p) return true;
      e.acc += e.rate * dt;
      const prev = e.prev || p;
      while (e.acc >= 1) {
        e.acc -= 1;
        const k = Math.random();
        const l = rand(0.35, 0.8);
        this.parts.push({ x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k, vx: rand(-30, 30), vy: rand(-30, 30), life: l, max: l, size: rand(e.size[0], e.size[1]), color: e.color, gravity: 0, drag: 2, glow: 0.9 });
      }
      // bright head
      ctx.globalAlpha = 0.9;
      const hs = 22;
      ctx.drawImage(this.sprites.white, p.x - hs, p.y - hs, hs * 2, hs * 2);
      e.prev = p;
      return true;
    });

    // particles
    const parts = this.parts;
    let w = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = Math.min(1, (p.life / p.max) * 1.4);
      // streak
      ctx.globalAlpha = a;
      ctx.strokeStyle = `rgba(${PALETTE[p.color]},1)`;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
      ctx.stroke();
      if (p.glow) {
        const r = p.size * 6;
        ctx.globalAlpha = a * p.glow * 0.55;
        ctx.drawImage(this.sprites[p.color], p.x - r, p.y - r, r * 2, r * 2);
      }
      parts[w++] = p;
    }
    parts.length = w;

    // rings
    this.rings = this.rings.filter((r) => {
      r.life -= dt;
      if (r.life <= 0) return false;
      const k = 1 - r.life / r.max;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = (1 - k) * r.alpha;
      ctx.strokeStyle = `rgba(${r.color},1)`;
      ctx.lineWidth = r.width * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * e, 0, Math.PI * 2);
      ctx.stroke();
      return true;
    });

    // flares (4-point anamorphic glints)
    this.flares = this.flares.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) return false;
      const k = 1 - f.life / f.max;
      const s = Math.sin(k * Math.PI);
      const size = f.size * (0.4 + 0.6 * s);
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot + k * 0.6);
      ctx.globalAlpha = s;
      for (let j = 0; j < 2; j++) {
        ctx.rotate(j * Math.PI / 2);
        const gr = ctx.createLinearGradient(-size, 0, size, 0);
        gr.addColorStop(0, `rgba(${f.color},0)`);
        gr.addColorStop(0.5, `rgba(255,255,255,1)`);
        gr.addColorStop(1, `rgba(${f.color},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(-size, -1.1, size * 2, 2.2);
      }
      const r = size * 0.45;
      ctx.drawImage(this.sprites.ice, -r, -r, r * 2, r * 2);
      ctx.restore();
      return true;
    });

    ctx.globalAlpha = 1;
    if (this.parts.length || this.rings.length || this.flares.length || this.emitters.length) {
      requestAnimationFrame((t) => this.loop(t));
    } else {
      ctx.clearRect(0, 0, this.W, this.H);
      this.running = false;
    }
  }
}
