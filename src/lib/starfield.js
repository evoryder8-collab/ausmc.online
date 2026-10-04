// Twinkling starfield with the Southern Cross drifting across the sky.

// Southern Cross offsets on the flag (relative to its centre, in flag heights)
const CRUX = [
  { x: 0, y: -0.333, r: 1, pts: 7 }, // Gamma (top)
  { x: -0.25, y: -0.063, r: 1, pts: 7 }, // Beta (left)
  { x: 0.277, y: -0.13, r: 1, pts: 7 }, // Delta (right)
  { x: 0.103, y: 0.042, r: 0.6, pts: 5 }, // Epsilon (small)
  { x: 0, y: 0.333, r: 1.05, pts: 7 }, // Alpha (bottom)
];

function starPath(ctx, x, y, R, pts, inner = 0.42) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (Math.PI / pts) * i - Math.PI / 2;
    const r = i % 2 ? R * inner : R;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function createStarfield(canvas, { reduced = false } = {}) {
  const ctx = canvas.getContext('2d');
  const api = { level: 0, scroll: 0, crux: 1 };
  let W = 0;
  let H = 0;
  let dpr = 1;
  let stars = [];

  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  const g = glow.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(220,232,255,.55)');
  grad.addColorStop(0.5, 'rgba(120,160,255,.12)');
  grad.addColorStop(1, 'rgba(120,160,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const count = Math.round(Math.min(220, (W * H) / 7000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random() * 1.6,
      z: 0.2 + Math.random() * 0.8,
      s: Math.random() < 0.06 ? 1.6 + Math.random() * 1.2 : 0.5 + Math.random() * 0.9,
      ph: Math.random() * Math.PI * 2,
      sp: 0.6 + Math.random() * 1.8,
      warm: Math.random() < 0.12,
    }));
  };
  resize();
  addEventListener('resize', resize);

  let last = 0;
  const t0 = performance.now();
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return;
    last = now;
    const t = reduced ? 0 : (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (api.level <= 0.001) return;
    ctx.globalCompositeOperation = 'lighter';

    for (const s of stars) {
      const y = ((s.y - api.scroll * 0.25 * s.z) % 1.6 + 1.6) % 1.6;
      if (y > 1.02) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      const a = tw * api.level * (0.35 + s.z * 0.65);
      const px = s.x * W;
      const py = y * H;
      if (s.s > 1.5) {
        const r = s.s * 7 * tw;
        ctx.globalAlpha = a * 0.8;
        ctx.drawImage(glow, px - r, py - r, r * 2, r * 2);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = s.warm ? '#ffd9df' : '#eef3ff';
      ctx.beginPath();
      ctx.arc(px, py, s.s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Southern Cross, high on the right, drifting gently
    if (api.crux > 0.001) {
      const scale = Math.min(W, H) * (W < 720 ? 0.34 : 0.42);
      const cx = W * (W < 720 ? 0.78 : 0.86) + Math.sin(t * 0.07) * 10;
      const cy = H * 0.3 - api.scroll * H * 0.35 + Math.cos(t * 0.09) * 8;
      CRUX.forEach((c, i) => {
        const tw = 0.75 + 0.25 * Math.sin(t * 1.3 + i * 1.7);
        const x = cx + c.x * scale;
        const y = cy + c.y * scale;
        const R = (W < 720 ? 5 : 7) * c.r;
        const alpha = api.level * api.crux * tw;
        ctx.globalAlpha = alpha * 0.55;
        const gr = R * 7;
        ctx.drawImage(glow, x - gr, y - gr, gr * 2, gr * 2);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = '#ffffff';
        starPath(ctx, x, y, R, c.pts);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };
  let raf = requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(draw);
  });
  return api;
}
