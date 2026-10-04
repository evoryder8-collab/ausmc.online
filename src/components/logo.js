import data from '../data/logo-layers.json';

const BASE = import.meta.env.BASE_URL;
const S = data.size;
const pct = (v) => `${((v / S) * 100).toFixed(4)}%`;

// Parallax depth (px) for each layer once the badge floats in the hero
export const DEPTH = {
  badge: 0,
  ring: 10,
  'text-top': 22,
  'text-bottom': 22,
  'leaf-left': 30,
  'leaf-right': 30,
  mainland: 44,
  tasmania: 46,
  'jack-white': 58,
  'jack-red': 62,
  'star-commonwealth': 72,
  'star-top': 80,
  'star-left': 80,
  'star-right': 80,
  'star-small': 84,
  'star-bottom': 80,
};

export const STAR_IDS = ['star-bottom', 'star-left', 'star-top', 'star-right', 'star-small'];

export function buildLogo() {
  const L = Object.fromEntries(data.layers.map((l) => [l.id, l]));
  const badge = L.badge;
  const cx = badge.x + badge.w / 2;
  const cy = badge.y + badge.h / 2;

  const root = document.createElement('div');
  root.className = 'logo';
  root.innerHTML = `
    <div class="logo__float">
      <div class="logo__glow"></div>
      <div class="logo__tilt">
        <div class="logo__canvas"></div>
      </div>
    </div>`;
  const canvas = root.querySelector('.logo__canvas');

  const origin = (l, id) => {
    switch (id) {
      case 'text-top':
      case 'text-bottom':
        return `${(((cx - l.x) / l.w) * 100).toFixed(3)}% ${(((cy - l.y) / l.h) * 100).toFixed(3)}%`;
      case 'leaf-left':
        return '78% 97%';
      case 'leaf-right':
        return '22% 97%';
      case 'mainland':
        return '50% 58%';
      case 'tasmania':
        return '75% 92%';
      default:
        return '50% 50%';
    }
  };

  const pieces = {};
  const imgs = [];
  for (const l of data.layers) {
    const p = document.createElement('div');
    p.className = `piece piece--${l.id}`;
    p.dataset.id = l.id;
    Object.assign(p.style, { left: pct(l.x), top: pct(l.y), width: pct(l.w), height: pct(l.h), transformOrigin: origin(l, l.id) });
    const img = new Image();
    img.decoding = 'async';
    img.alt = '';
    img.draggable = false;
    img.src = `${BASE}${l.src}`;
    imgs.push(img);
    p.appendChild(img);
    canvas.appendChild(p);
    pieces[l.id] = p;
  }

  // Overlays that live on the badge: rim glint + gleam sweep
  const disc = (cls) => {
    const d = document.createElement('div');
    d.className = cls;
    Object.assign(d.style, { left: pct(badge.x), top: pct(badge.y), width: pct(badge.w), height: pct(badge.h) });
    canvas.appendChild(d);
    return d;
  };
  const rim = disc('logo__rim');
  const gleam = disc('logo__gleam');
  gleam.innerHTML = '<span></span>';

  const ready = Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())));

  /** Screen-space point inside the logo, from layer-canvas coordinates */
  const point = (x, y) => {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (x / S) * r.width, y: r.top + (y / S) * r.height, scale: r.width / S };
  };
  const centerOf = (id, ox = 0.5, oy = 0.5) => {
    const l = L[id];
    return point(l.x + l.w * ox, l.y + l.h * oy);
  };

  // Pixel-exact centres of the stars (their crop boxes include padding)
  return {
    root,
    canvas,
    float: root.querySelector('.logo__float'),
    tilt: root.querySelector('.logo__tilt'),
    glow: root.querySelector('.logo__glow'),
    rim,
    gleam,
    pieces,
    layers: L,
    ready,
    point,
    centerOf,
    badgeCenter: () => point(cx, cy),
    size: () => canvas.getBoundingClientRect().width,
  };
}
