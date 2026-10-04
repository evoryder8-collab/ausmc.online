// Liquid glass helpers.
//  1. Pointer-tracked specular: every visible .glass gets --mx/--my (light
//     position) and --rim (angle of the rim highlight toward the pointer).
//  2. True edge refraction on [data-lens] panels in Chromium, where an SVG
//     displacement filter can be used as a backdrop-filter. Other engines
//     keep the (still lovely) blur + specular version.

const supportsLens = (() => {
  try {
    const brands = navigator.userAgentData?.brands?.map((b) => b.brand) || [];
    const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/.test(b));
    const fine = matchMedia('(pointer: fine)').matches;
    return chromium && fine && CSS.supports('backdrop-filter', 'blur(1px)');
  } catch {
    return false;
  }
})();

let svgRoot = null;
let lensId = 0;

function ensureSvg() {
  if (svgRoot) return svgRoot;
  svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgRoot.setAttribute('width', '0');
  svgRoot.setAttribute('height', '0');
  svgRoot.setAttribute('aria-hidden', 'true');
  svgRoot.style.position = 'absolute';
  document.body.appendChild(svgRoot);
  return svgRoot;
}

/** Displacement map for a rounded rectangle with a convex bevel. */
function displacementMap(w, h, radius, bevel) {
  const s = 0.5;
  const W = Math.max(4, Math.round(w * s));
  const H = Math.max(4, Math.round(h * s));
  const R = Math.min(radius * s, W / 2, H / 2);
  const B = Math.max(2, bevel * s);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - W / 2;
      const py = y + 0.5 - H / 2;
      const qx = Math.abs(px) - (W / 2 - R);
      const qy = Math.abs(py) - (H / 2 - R);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const outside = Math.hypot(ox, oy);
      const dist = outside + Math.min(Math.max(qx, qy), 0) - R;
      const inset = -dist;
      let dx = 0;
      let dy = 0;
      if (inset >= 0 && inset < B) {
        let nx;
        let ny;
        if (qx > 0 && qy > 0) {
          nx = ox / (outside || 1);
          ny = oy / (outside || 1);
        } else if (qx > qy) {
          nx = 1;
          ny = 0;
        } else {
          nx = 0;
          ny = 1;
        }
        nx *= Math.sign(px) || 1;
        ny *= Math.sign(py) || 1;
        const k = 1 - inset / B;
        const m = Math.pow(k, 2.4);
        dx = -nx * m;
        dy = -ny * m;
      }
      const i = (y * W + x) * 4;
      d[i] = 128 + dx * 127;
      d[i + 1] = 128 + dy * 127;
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

function applyLens(el) {
  const root = ensureSvg();
  const id = `lens-${++lensId}`;
  const ns = 'http://www.w3.org/2000/svg';
  const filter = document.createElementNS(ns, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  const feImage = document.createElementNS(ns, 'feImage');
  feImage.setAttribute('result', 'map');
  feImage.setAttribute('preserveAspectRatio', 'none');
  const disp = document.createElementNS(ns, 'feDisplacementMap');
  disp.setAttribute('in', 'SourceGraphic');
  disp.setAttribute('in2', 'map');
  disp.setAttribute('xChannelSelector', 'R');
  disp.setAttribute('yChannelSelector', 'G');
  filter.append(feImage, disp);
  root.appendChild(filter);

  let lastKey = '';
  const update = () => {
    const r = el.getBoundingClientRect();
    const w = Math.round(el.offsetWidth || r.width);
    const h = Math.round(el.offsetHeight || r.height);
    if (!w || !h) return;
    const key = `${w}x${h}`;
    if (key === lastKey) return;
    lastKey = key;
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 24;
    const bevel = Math.min(Math.max(14, Math.min(w, h) * 0.16), 44);
    feImage.setAttribute('href', displacementMap(w, h, radius, bevel));
    feImage.setAttribute('x', '0');
    feImage.setAttribute('y', '0');
    feImage.setAttribute('width', String(w));
    feImage.setAttribute('height', String(h));
    disp.setAttribute('scale', String(Math.round(Math.min(64, bevel * 1.5))));
    el.style.setProperty('--lens', `url(#${id})`);
    el.classList.add('has-lens');
  };
  new ResizeObserver(update).observe(el);
  update();
}

export function initGlass() {
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
  });
  const track = (root = document) => root.querySelectorAll('.glass').forEach((el) => io.observe(el));
  track();

  if (supportsLens) document.querySelectorAll('[data-lens]').forEach(applyLens);

  let px = innerWidth / 2;
  let py = -200;
  let queued = false;
  const paint = () => {
    queued = false;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      const mx = ((px - r.left) / r.width) * 100;
      const my = ((py - r.top) / r.height) * 100;
      const ang = (Math.atan2(py - (r.top + r.height / 2), px - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      el.style.setProperty('--mx', `${mx.toFixed(1)}%`);
      el.style.setProperty('--my', `${my.toFixed(1)}%`);
      el.style.setProperty('--rim', `${ang.toFixed(1)}deg`);
    }
  };
  addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }, { passive: true });
  addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paint);
    }
  }, { passive: true });

  return { track, refresh: paint, lens: (el) => supportsLens && applyLens(el) };
}
