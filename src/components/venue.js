import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LOCATIONS } from '../data/schedule.js';
import { icon } from '../lib/icons.js';
import { spring } from '../lib/spring.js';
import { sound } from '../lib/audio.js';

gsap.registerPlugin(ScrollTrigger);

const BASE = import.meta.env.BASE_URL;
const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const directions = (loc, provider) => {
  const [lng, lat] = loc.lngLat;
  if (provider === 'apple') {
    const q = encodeURIComponent(loc.query);
    return `https://maps.apple.com/?daddr=${q}&ll=${lat},${lng}${loc.travelmode === 'transit' ? '&dirflg=r' : ''}`;
  }
  const p = new URLSearchParams({ api: '1', destination: loc.query });
  if (loc.travelmode) p.set('travelmode', loc.travelmode);
  return `https://www.google.com/maps/dir/?${p}`;
};

const INFO = {
  venue: [
    ['ferry', 'By ferry', 'F3 & F8 ferries from Circular Quay (Wharf 5) or Barangaroo, about 15 minutes. Tap on with Opal or contactless.'],
    ['car', 'No car access', 'Street parking only near ferry wharves (Balmain, Birchgrove, Woolwich).'],
    ['coffee', 'On the island', 'Cafés and bars on site, plus accessible paths and facilities.'],
  ],
  dinner: [
    ['calendar', 'Sunday 11 October', 'From 6:00 PM, to celebrate the 2026 champions.'],
    ['nav', 'Getting there', 'In the Sydney CBD, a short walk from Town Hall station.'],
  ],
};

export function initVenue({ lenis, reduced, glass }) {
  const panel = document.querySelector('.venue__panel');
  const switcher = document.querySelector('.map__switch');
  const mapEl = document.getElementById('map');
  const mapWrap = document.querySelector('.venue__map');
  let current = 'venue';
  let map = null;
  let markers = {};
  let orbit = null;

  switcher.innerHTML = Object.values(LOCATIONS).map((l) => `
    <button type="button" role="tab" data-loc="${l.id}" aria-selected="${l.id === current}">
      ${icon(l.id === 'venue' ? 'pin' : 'dinner')}<span>${l.id === 'venue' ? 'Championship' : 'Dinner Party'}</span>
    </button>`).join('');

  const renderPanel = (animate) => {
    const loc = LOCATIONS[current];
    const primary = isApple ? 'apple' : 'google';
    panel.innerHTML = `
      <p class="venue__role">${esc(loc.role)}</p>
      <h3 class="venue__name">${esc(loc.name)}</h3>
      <p class="venue__when">${icon('calendar')}${esc(loc.when)}</p>
      <p class="venue__addr">${icon('pin')}<span>${esc(loc.address)}</span></p>
      <p class="venue__blurb">${esc(loc.blurb)}</p>
      <a class="btn-here" href="${directions(loc, primary)}" target="_blank" rel="noopener">
        <span class="btn-here__glow" aria-hidden="true"></span>
        ${icon('nav')}<span>Bring Me Here</span>
      </a>
      <p class="venue__alt">Open in <a href="${directions(loc, 'google')}" target="_blank" rel="noopener">Google Maps</a> · <a href="${directions(loc, 'apple')}" target="_blank" rel="noopener">Apple Maps</a></p>
      <ul class="venue__info">
        ${INFO[current].map(([ic, h, p]) => `<li>${icon(ic)}<div><strong>${esc(h)}</strong><span>${esc(p)}</span></div></li>`).join('')}
      </ul>`;
    panel.querySelector('.btn-here').addEventListener('click', () => sound.tap());
    panel.querySelector('.btn-here').addEventListener('pointerenter', () => sound.hover());
    if (animate && !reduced) {
      gsap.fromTo(panel.children, { opacity: 0, y: 18, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.045, ease: spring({ bounce: 0.25 }) });
    }
  };
  renderPanel(false);

  const select = (id, { fly = true } = {}) => {
    if (!LOCATIONS[id]) return;
    const changed = id !== current;
    current = id;
    switcher.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.loc === id)));
    if (changed) renderPanel(true);
    Object.entries(markers).forEach(([k, m]) => m.getElement().classList.toggle('is-active', k === id));
    if (map && fly) flyTo(id);
  };

  switcher.addEventListener('click', (e) => {
    const b = e.target.closest('[data-loc]');
    if (!b) return;
    sound.tap();
    select(b.dataset.loc);
  });
  document.addEventListener('ausmc:location', (e) => select(e.detail));

  // entrance
  if (!reduced) {
    gsap.fromTo(mapWrap, { opacity: 0, y: 80, scale: 0.94, borderRadius: 64 }, { opacity: 1, y: 0, scale: 1, borderRadius: 36, duration: 1.4, ease: spring({ bounce: 0.2 }), scrollTrigger: { trigger: mapWrap, start: 'top 85%', once: true } });
    gsap.fromTo(panel, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 1.3, delay: 0.15, ease: spring({ bounce: 0.22 }), scrollTrigger: { trigger: mapWrap, start: 'top 85%', once: true } });
  }

  // ───────────── map (lazy) ─────────────
  const stopOrbit = () => {
    if (orbit) {
      orbit.kill();
      orbit = null;
    }
  };
  const startOrbit = () => {
    if (!map || reduced) return;
    stopOrbit();
    const o = { b: map.getBearing() };
    orbit = gsap.to(o, { b: o.b + 360, duration: 240, ease: 'none', repeat: -1, onUpdate: () => map.setBearing(o.b) });
  };

  function flyTo(id, first = false) {
    const loc = LOCATIONS[id];
    stopOrbit();
    const opts = id === 'venue'
      ? { center: loc.lngLat, zoom: innerWidth < 720 ? 14.6 : 15.3, pitch: 58, bearing: -24 }
      : { center: loc.lngLat, zoom: innerWidth < 720 ? 15.8 : 16.4, pitch: 62, bearing: 18 };
    map.flyTo({ ...opts, duration: first ? 6200 : 3200, curve: first ? 1.7 : 1.3, essential: true });
    map.once('moveend', () => startOrbit());
  }

  const fallback = () => {
    mapEl.innerHTML = `<iframe title="Map of Cockatoo Island, Sydney" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=${encodeURIComponent(LOCATIONS[current].query)}&z=15&output=embed"></iframe>`;
    mapWrap.classList.add('is-ready', 'is-fallback');
  };

  const loadMap = async () => {
    try {
      const [{ Map, Marker, AttributionControl, setWorkerUrl }, workerUrl] = await Promise.all([
        import('maplibre-gl'),
        import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url').then((m) => m.default),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ]);
      setWorkerUrl(workerUrl);
      const style = await fetch('https://tiles.openfreemap.org/styles/dark').then((r) => r.json());
      restyle(style);

      map = new Map({
        container: mapEl,
        style,
        center: [134.5, -27.5],
        zoom: innerWidth < 720 ? 2.6 : 3.2,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        cooperativeGestures: true,
        maxPitch: 70,
        fadeDuration: 250,
      });
      map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach((ev) => map.on(ev, stopOrbit));

      Object.values(LOCATIONS).forEach((loc) => {
        const el = document.createElement('div');
        el.className = `marker marker--${loc.id}${loc.id === current ? ' is-active' : ''}`;
        el.innerHTML = loc.id === 'venue'
          ? `<span class="marker__pulse"></span><span class="marker__pulse marker__pulse--2"></span><img src="${BASE}logo/badge-192.png" alt="" /><span class="marker__label glass">${esc(loc.name)}</span>`
          : `<span class="marker__pulse"></span><span class="marker__core">${icon('dinner')}</span><span class="marker__label glass">${esc(loc.name)}</span>`;
        el.addEventListener('click', () => { sound.tap(); select(loc.id); });
        markers[loc.id] = new Marker({ element: el, anchor: 'center' }).setLngLat(loc.lngLat).addTo(map);
      });

      map.on('load', () => {
        mapWrap.classList.add('is-ready');
        mapEl.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        ScrollTrigger.create({
          trigger: mapWrap,
          start: 'top 70%',
          once: true,
          onEnter: () => {
            flyTo(current, true);
            sound.whoosh({ dur: 2.4, f0: 120, f1: 700, gain: 0.1, pan0: -0.3, pan1: 0.3, wet: 0.5 });
          },
        });
      });
    } catch (err) {
      console.warn('[map] falling back to embed', err);
      fallback();
    }
  };

  // start loading once the visitor is getting close to the section
  ScrollTrigger.create({ trigger: '#venue', start: 'top 250%', once: true, onEnter: loadMap });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Recolour the OpenFreeMap dark style into the AusMC navy / red palette */
function restyle(style) {
  const C = {
    bg: '#030b22',
    water: '#0b2a6f',
    land: '#061537',
    park: '#0a2048',
    road: '#1c3466',
    roadMajor: '#2b4a8c',
    motorway: '#4166b8',
    rail: '#1a2c5c',
    text: '#c8d6ff',
    halo: '#030b22',
    boundary: '#2a4a8a',
  };
  style.layers = style.layers.filter((l) => l.id !== 'building');
  for (const l of style.layers) {
    const p = (l.paint = l.paint || {});
    const id = l.id;
    if (l.type === 'background') p['background-color'] = C.bg;
    else if (id === 'water') p['fill-color'] = C.water;
    else if (id === 'waterway') p['line-color'] = C.water;
    else if (id.startsWith('landuse_residential')) p['fill-color'] = C.land;
    else if (id.startsWith('landcover') || id.startsWith('landuse_park')) p['fill-color'] = C.park;
    else if (id.startsWith('highway_motorway')) p['line-color'] = C.motorway;
    else if (id.startsWith('highway_major')) p['line-color'] = C.roadMajor;
    else if (id.startsWith('highway') || id.startsWith('road')) {
      if (l.type === 'line') p['line-color'] = C.road;
      if (l.type === 'fill') p['fill-color'] = C.road;
    } else if (id.startsWith('railway')) p['line-color'] = C.rail;
    else if (id.startsWith('boundary')) p['line-color'] = C.boundary;
    else if (id.startsWith('aeroway')) {
      if (l.type === 'line') p['line-color'] = C.road;
      if (l.type === 'fill') p['fill-color'] = C.land;
    }
    if (l.type === 'symbol' && l.layout?.['text-field']) {
      p['text-color'] = id === 'water_name' ? '#7f9fe6' : C.text;
      p['text-halo-color'] = C.halo;
      p['text-halo-width'] = 1.2;
    }
  }
  // 3D buildings, lit navy with a cool glow on top
  const labelIdx = style.layers.findIndex((l) => l.type === 'symbol');
  style.layers.splice(labelIdx, 0, {
    id: 'ausmc-buildings',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0], 0, '#0c2253', 60, '#1a3b86', 200, '#3560c4'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 0]],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.88,
    },
  });
}
