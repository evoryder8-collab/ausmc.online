import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import 'lenis/dist/lenis.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/portal-intro.css';
import './styles/hero.css';
import './styles/schedule.css';
import './styles/venue.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';

import { sound } from './lib/audio.js';
import { createBackground } from './lib/background.js';
import { createStarfield } from './lib/starfield.js';
import { FX } from './lib/fx.js';
import { initGlass } from './lib/glass.js';
import { hydrateIcons } from './lib/icons.js';
import { spring } from './lib/spring.js';
import { buildLogo } from './components/logo.js';
import { playIntro } from './components/intro.js';
import { initHero, heroEnter } from './components/hero.js';
import { initSchedule } from './components/schedule.js';
import { initVenue } from './components/venue.js';

gsap.registerPlugin(ScrollTrigger, Flip);
if (import.meta.env.DEV) window.__ausmc = { gsap, ScrollTrigger };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

// ───────────── atmosphere ─────────────
const bg = createBackground(document.getElementById('bg'), { reduced });
const stars = createStarfield(document.getElementById('stars'), { reduced });
bg.level = 0.42;
stars.level = 0.45;
const fx = new FX(document.getElementById('fx'));

// film grain tile
(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const g = c.getContext('2d');
  const d = g.createImageData(140, 140);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  root.style.setProperty('--grain', `url(${c.toDataURL()})`);
})();

// portal constellation
(() => {
  const g = document.querySelector('.portal__cross-stars');
  const pts = [[60, 14, 7, 7], [33, 55, 7, 7], [88, 46, 7, 7], [72, 68, 4.2, 5], [60, 106, 7.6, 7]];
  g.innerHTML = pts.map(([x, y, r, n], i) => {
    let d = '';
    for (let k = 0; k < n * 2; k++) {
      const a = (Math.PI / n) * k - Math.PI / 2;
      const rr = k % 2 ? r * 0.42 : r;
      d += `${k ? 'L' : 'M'}${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`;
    }
    return `<path d="${d}Z" style="--i:${i}"/>`;
  }).join('');
})();

hydrateIcons();
const glass = initGlass();

// ───────────── logo ─────────────
const logo = buildLogo();
document.querySelector('.intro__slot').appendChild(logo.root);

// ───────────── smooth scroll ─────────────
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1.2 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  if (import.meta.env.DEV) window.__ausmc.lenis = lenis;
}

// ───────────── page sections ─────────────
const hero = initHero({ logo, reduced });
initSchedule({ lenis, reduced, glass });
initVenue({ lenis, reduced, glass });
hydrateIcons();
glass.track();

gsap.set(['.hero__halo', '.hero__title-main', '.hero__title-year', '.hero__eyebrow', '.hero__name', '.hero__meta li', '.countdown', '.hero__ctas > *', '.hero__scroll'], { opacity: 0 });
gsap.set('#nav', { opacity: 0, y: -90 });

// scroll-linked atmosphere
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate: (self) => {
    bg.scroll = self.progress * 2.2;
    stars.scroll = self.progress * 2.6;
    stars.crux = Math.max(0, 1 - self.progress * 3);
    document.querySelector('.progress span').style.transform = `scaleX(${self.progress})`;
  },
});
if (!reduced) {
  document.querySelectorAll('.orb').forEach((orb, i) => {
    gsap.to(orb, { yPercent: -60 - i * 45, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 1.2 } });
  });
}

// in-page anchors glide with Lenis
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? 0 : document.querySelector(id);
  if (target == null) return;
  e.preventDefault();
  sound.tap();
  if (lenis) lenis.scrollTo(target, { offset: id === '#top' ? 0 : -90, duration: 1.6 });
  else (target === 0 ? scrollTo({ top: 0, behavior: 'smooth' }) : target.scrollIntoView({ behavior: 'smooth' }));
});
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('button, .btn, .nav__links a, .nav__brand, .credit, .footer__top');
  if (el && !el.contains(e.relatedTarget)) sound.hover();
});

// sound toggle in the nav
const toggle = document.querySelector('.sound-toggle');
const syncToggle = () => {
  toggle.setAttribute('aria-pressed', String(sound.enabled));
  toggle.setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Turn sound on');
  toggle.classList.toggle('is-on', sound.enabled);
};
toggle.addEventListener('click', () => {
  sound.setEnabled(!sound.enabled);
  if (sound.enabled) {
    sound.startAmbient();
    sound.chime(81, { gain: 0.08, dur: 1.4 });
  }
  syncToggle();
});

// ───────────── 1 · portal ─────────────
const portal = document.getElementById('portal');
const intro = document.getElementById('intro');
const card = portal.querySelector('.portal__card');
let begun = false;

if (!reduced) {
  gsap.fromTo(card, { opacity: 0, y: 40, scale: 0.94, filter: 'blur(14px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.4, ease: spring({ bounce: 0.25 }), delay: 0.15 });
  gsap.fromTo(card.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, stagger: 0.07, ease: spring({ bounce: 0.3 }), delay: 0.35 });
}
portal.querySelector('.btn-yes').focus({ preventScroll: true });

portal.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sound]');
  if (btn) begin(btn.dataset.sound === 'on', btn);
});

async function begin(withSound, btn) {
  if (begun) return;
  begun = true;
  sound.setEnabled(withSound); // inside the click: unlocks audio on iOS
  syncToggle();
  if (withSound) sound.tap();

  const r = btn.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: withSound ? 36 : 16, speed: [120, 480], life: [0.4, 0.9], colors: ['white', 'ice', 'blue', 'red'], gravity: 120 });

  await gsap.timeline()
    .to(btn, { scale: 0.92, duration: 0.09, ease: 'power2.out' })
    .to(btn, { scale: 1, duration: 0.6, ease: spring({ bounce: 0.5 }) })
    .to(card, { scale: 1.08, opacity: 0, filter: 'blur(18px)', duration: 0.7, ease: 'power2.in' }, 0.12)
    .to(portal, { opacity: 0, duration: 0.6, ease: 'power1.inOut' }, 0.35);
  portal.remove();

  await logo.ready;
  intro.classList.add('is-active');
  await playIntro({ logo, stage: intro, fx, bg, stars, reduced });
  await revealPage();
}

// ───────────── 3 · hand-off: badge flies into the hero ─────────────
async function revealPage() {
  const slot = document.querySelector('.hero__slot');
  const state = Flip.getState(logo.root);
  slot.appendChild(logo.root);
  logo.root.classList.add('is-flying');

  const tl = gsap.timeline();
  tl.add(Flip.from(state, { duration: reduced ? 0.6 : 1.55, ease: 'expo.inOut', scale: true }), 0);
  tl.to('.intro__bg', { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, 0.15);
  tl.to(['.intro__caption', '.intro__skip'], { opacity: 0, y: -30, duration: 0.6, ease: 'power2.in' }, 0);
  tl.to('.intro__rays', { opacity: 0, scale: 1.3, duration: 1.2, ease: 'power2.inOut' }, 0);
  tl.to(bg, { level: 1, pulse: 0, duration: 1.6 }, 0);
  tl.to(stars, { level: 1, duration: 1.6 }, 0);
  tl.call(() => sound.whoosh({ dur: 1.4, f0: 1400, f1: 220, gain: 0.14, pan0: -0.2, pan1: 0.5, wet: 0.4 }), null, 0);
  tl.add(heroEnter({ reduced }), reduced ? 0.2 : 0.7);
  tl.to('#nav', { opacity: 1, y: 0, duration: 1.2, ease: spring({ bounce: 0.32 }) }, reduced ? 0.2 : 0.95);
  tl.to('.hero__halo', { opacity: 1, duration: 2 }, 0.8);
  await tl;

  intro.remove();
  logo.root.classList.remove('is-flying');
  root.classList.remove('is-locked');
  lenis?.start();
  ScrollTrigger.refresh();
  hero.activate();
  if (sound.enabled) sound.startAmbient();

  const hash = location.hash && document.querySelector(location.hash);
  if (hash) lenis ? lenis.scrollTo(hash, { offset: -90, duration: 1.8 }) : hash.scrollIntoView({ behavior: 'smooth' });
}

document.fonts?.ready.then(() => ScrollTrigger.refresh());
