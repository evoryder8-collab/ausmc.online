// Fireworks over the night-skyline header. Shells follow real ballistic
// physics, so the flight time is known exactly — that lets bursts be landed on
// a precise moment (e.g. the song's "again." beats). Every launch and burst
// fires its matching sound at the same instant.

const G = 520; // px/s² for shells
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

const PALETTES = [
  ['255,45,85', '255,255,255'],
  ['106,149,255', '255,255,255'],
  ['255,45,85', '106,149,255', '255,255,255'],
  ['255,255,255', '210,225,255'],
  ['255,215,140', '255,245,220'], // a little gold, like the real Harbour show
  ['255,45,85', '255,120,150'],
];

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export class Fireworks {
  constructor(canvas, { sound, reduced = false } = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = sound;
    this.reduced = reduced;
    this.shells = [];
    this.sparks = [];
    this.flashes = [];
    this.visible = false;
    this.auto = false;
    this.nextAuto = 0;
    this.sprite = glowSprite();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting && e.intersectionRatio > 0.05;
      if (this.visible) this.kick();
    }, { threshold: [0, 0.05, 0.3] }).observe(canvas.parentElement);
    document.addEventListener('visibilitychange', () => !document.hidden && this.kick());
  }

  resize() {
    const r = this.c.parentElement.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, innerWidth < 720 ? 2 : 1.5);
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.c.width = Math.round(this.W * this.dpr);
    this.c.height = Math.round(this.H * this.dpr);
  }

  get active() {
    return this.visible && !document.hidden;
  }

  /**
   * `welcome`: a short, intense opening wave (~4s) with exactly one star and
   * one heart that blooms right behind the badge (`heartAround`), framing it.
   * Then the normal show takes over.
   */
  start({ welcome = false, heartAround = null } = {}) {
    this.auto = !this.reduced;
    const now = performance.now();
    this.nextAuto = now + (welcome ? 4300 : 600);
    this.kick();
    if (!welcome) return;
    const mixed = () => pick(['peony', 'ring', 'chrys', 'crackle', 'willow']);
    const at = (ms, fn) => setTimeout(fn, ms);
    at(0, () => this.volley(3, { typeFn: mixed, size: 1.05 }));
    at(750, () => this.volley(2, { typeFn: mixed, size: 1.1 }));
    if (heartAround) this.heartAround(heartAround, now + 1650);
    at(1900, () => this.launch({ type: 'star', size: 1.2, x: this.W * (Math.random() < 0.5 ? 0.24 : 0.76), y: this.H * 0.2 }));
    at(2400, () => this.volley(3, { typeFn: mixed, size: 1.1 }));
    at(3200, () => this.volley(2, { typeFn: mixed }));
  }

  /** a heart burst sized and centred so `el` (the badge) sits inside it */
  heartAround(el, burstAt) {
    const m = this.c.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    // the heart's largest inscribed circle: radius 0.494, centred 0.2 below the burst point
    const R = (r.width * 0.47 * 1.14) / 0.494;
    const cx = r.left - m.left + r.width / 2;
    const cy = r.top - m.top + r.height / 2;
    this.launch({ x: cx, y: cy - R * 0.2, type: 'heart', size: 1.3, radius: R, burstAt, ifLate: 'launch', palette: ['255,45,85', '255,255,255', '255,130,160'] });
  }

  kick() {
    if (this.running || !this.active) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** time (s) a shell needs to climb to height h */
  flightTime(h) {
    return Math.sqrt((2 * h) / G);
  }

  /**
   * Launch a shell. `burstAt` (performance.now() ms) lands the explosion on
   * that instant by delaying the launch by exactly the flight time.
   */
  launch({ x, y, type, palette, size = 1, burstAt, sfx = true, radius, ifLate = 'burst' } = {}) {
    if (!this.active) return;
    const W = this.W;
    const H = this.H;
    const tx = x ?? rand(W * 0.1, W * 0.9);
    const ty = y ?? rand(H * 0.1, H * 0.42);
    const h = H + 10 - ty;
    const T = this.flightTime(h);
    const go = () => {
      if (!this.active) return;
      const sx = tx + rand(-W * 0.06, W * 0.06);
      this.shells.push({
        x: sx,
        y: H + 10,
        vx: (tx - sx) / T,
        vy: -G * T,
        t: 0,
        T,
        type: type || pick(['peony', 'peony', 'ring', 'chrys', 'willow', 'crackle', 'star']),
        palette: palette || pick(PALETTES),
        size,
        sfx,
        radius,
        trail: [],
      });
      if (sfx) this.sound?.fwLaunch({ dur: T, pan: (tx / W) * 2 - 1, gain: 0.026 + 0.012 * size });
      this.kick();
    };
    if (burstAt) {
      const wait = burstAt - T * 1000 - performance.now();
      if (wait > 0) setTimeout(go, wait);
      else if (ifLate === 'launch') go(); // keep the climb; it blooms when it arrives
      else this.burst({ x: tx, y: ty, type: type || 'peony', palette: palette || pick(PALETTES), size, sfx, radius });
    } else go();
  }

  volley(n = 4, { typeFn, ...opts } = {}) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.launch({ ...opts, type: typeFn ? typeFn() : opts.type, x: this.W * (0.15 + (0.7 * (i + 0.5)) / n) + rand(-40, 40) }), i * rand(110, 220));
    }
  }

  burst({ x, y, type = 'peony', palette = pick(PALETTES), size = 1, sfx = true, radius }) {
    const s = Math.min(this.W, this.H * 1.4) / 900;
    // with drag k = 1.6 a spark covers ~83% of v/k by 1.1s: aim the shape at `radius` then
    const speed = radius ? (radius * 1.6) / 0.83 / 1.05 : rand(170, 260) * s * (0.8 + 0.35 * size);
    const col = () => pick(palette);
    const add = (vx, vy, o = {}) => this.sparks.push({ x, y, vx, vy, life: o.life ?? rand(1.1, 1.8), max: o.life ?? 1.6, color: o.color || col(), size: o.size ?? rand(1.2, 2.2), drag: o.drag ?? 1.25, g: o.g ?? 90, trail: [], twinkle: o.twinkle || false, tail: o.tail ?? 5 });
    const N = Math.round((type === 'willow' ? 70 : 110) * (0.7 + 0.4 * size));

    if (type === 'ring') {
      const tilt = rand(0.35, 1);
      const rot = rand(0, Math.PI);
      for (let i = 0; i < N * 0.7; i++) {
        const a = (i / (N * 0.7)) * Math.PI * 2;
        const cx = Math.cos(a) * speed;
        const cy = Math.sin(a) * speed * tilt;
        add(cx * Math.cos(rot) - cy * Math.sin(rot), cx * Math.sin(rot) + cy * Math.cos(rot));
      }
    } else if (type === 'star' || type === 'heart') {
      // shaped bursts: a 7-point Commonwealth star, or a heart
      const pts = [];
      if (type === 'star') {
        for (let i = 0; i < 14; i++) {
          const a = (Math.PI / 7) * i - Math.PI / 2;
          const r = i % 2 ? 0.42 : 1;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        pts.push(pts[0]);
      } else {
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          pts.push([(16 * Math.pow(Math.sin(a), 3)) / 17, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17]);
        }
      }
      const per = Math.ceil((radius ? Math.max(N, radius * 1.1) : N) / (pts.length - 1));
      for (let k = 0; k < pts.length - 1; k++) {
        for (let j = 0; j < per; j++) {
          const f = j / per;
          const px = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f;
          const py = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
          add(px * speed * 1.05, py * speed * 1.05, { drag: 1.6, g: radius ? 14 : 50, life: radius ? rand(1.9, 2.3) : rand(1.3, 1.7), color: type === 'heart' ? pick(['255,45,85', '255,120,150', '255,255,255']) : col() });
        }
      }
    } else {
      for (let i = 0; i < N; i++) {
        // uniform sphere projected to 2D reads as a real 3D shell
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const v = speed * (type === 'chrys' ? rand(0.85, 1) : rand(0.7, 1));
        if (type === 'willow') add(Math.cos(a) * r * v * 0.8, Math.sin(a) * r * v * 0.8, { life: rand(2.2, 3.2), drag: 1.9, g: 70, color: pick(['255,215,140', '255,245,220', '255,255,255']), size: rand(1, 1.6), tail: 12 });
        else if (type === 'crackle') add(Math.cos(a) * r * v, Math.sin(a) * r * v, { twinkle: true, life: rand(1.0, 1.5) });
        else add(Math.cos(a) * r * v, Math.sin(a) * r * v, { tail: type === 'chrys' ? 9 : 5 });
      }
    }
    this.flashes.push({ x, y, r: 260 * s * (0.8 + 0.4 * size), life: 0.5, max: 0.5, color: palette[0] });
    if (sfx && this.sound) {
      const pan = (x / this.W) * 2 - 1;
      this.sound.fwBoom({ pan, size, gain: 0.19 + 0.06 * size });
      if (type === 'crackle' || type === 'willow' || Math.random() < 0.25) this.sound.fwCrackle({ pan, delay: type === 'willow' ? 0.5 : 0.3, dur: type === 'willow' ? 1.8 : 1.1 });
    }
    this.kick();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.auto && this.active && now > this.nextAuto) {
      if (Math.random() < 0.18) this.volley(Math.round(rand(3, 5)));
      else this.launch({ size: rand(0.7, 1.2) });
      this.nextAuto = now + rand(900, 2600);
    }

    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // flashes light up the sky around each burst
    this.flashes = this.flashes.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) return false;
      const k = f.life / f.max;
      const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      gr.addColorStop(0, `rgba(${f.color},${0.22 * k})`);
      gr.addColorStop(1, `rgba(${f.color},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      return true;
    });

    // climbing shells
    this.shells = this.shells.filter((s) => {
      s.t += dt;
      s.trail.push([s.x, s.y]);
      if (s.trail.length > 10) s.trail.shift();
      s.x += s.vx * dt;
      s.vy += G * dt;
      s.y += s.vy * dt;
      for (let i = 1; i < s.trail.length; i++) {
        ctx.globalAlpha = (i / s.trail.length) * 0.5;
        ctx.strokeStyle = 'rgba(255,225,200,1)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(s.trail[i - 1][0], s.trail[i - 1][1]);
        ctx.lineTo(s.trail[i][0], s.trail[i][1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.sprite, s.x - 6, s.y - 6, 12, 12);
      if (s.t >= s.T) {
        this.burst({ x: s.x, y: s.y, type: s.type, palette: s.palette, size: s.size, sfx: s.sfx, radius: s.radius });
        return false;
      }
      return true;
    });

    // sparks
    const sp = this.sparks;
    let w = 0;
    for (let i = 0; i < sp.length; i++) {
      const p = sp[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.trail.push(p.x, p.y);
      if (p.trail.length > p.tail * 2) p.trail.splice(0, 2);
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      let a = Math.min(1, (p.life / p.max) * 1.6);
      if (p.twinkle && p.life < p.max * 0.6) a *= Math.random() < 0.5 ? 1 : 0.1;
      const tr = p.trail;
      ctx.strokeStyle = `rgba(${p.color},1)`;
      for (let j = 2; j < tr.length; j += 2) {
        ctx.globalAlpha = a * (j / tr.length) * 0.7;
        ctx.lineWidth = p.size * (j / tr.length);
        ctx.beginPath();
        ctx.moveTo(tr[j - 2], tr[j - 1]);
        ctx.lineTo(tr[j], tr[j + 1]);
        ctx.stroke();
      }
      ctx.globalAlpha = a;
      const r = p.size * 3.2;
      ctx.drawImage(this.sprite, p.x - r, p.y - r, r * 2, r * 2);
      sp[w++] = p;
    }
    sp.length = w;
    ctx.globalAlpha = 1;

    if (this.active && (this.auto || this.shells.length || this.sparks.length || this.flashes.length)) {
      requestAnimationFrame((t) => this.loop(t));
    } else {
      ctx.clearRect(0, 0, this.W, this.H);
      this.running = false;
    }
  }
}
