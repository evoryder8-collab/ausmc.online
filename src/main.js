import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/jost';
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
import { createLyrics } from './components/lyrics.js';
import { createFilm, createLoop, createSong } from './components/media.js';
import { Fireworks } from './lib/fireworks.js';
import { watchReading } from './components/reading.js';

gsap.registerPlugin(ScrollTrigger);
if (import.meta.env.DEV) window.__ausmc = { gsap, ScrollTrigger };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
// iOS can restore the old scroll position late, after reloading a tab it had
// discarded: hold the page at the top for as long as the intro owns the screen
const pinTop = () => root.classList.contains('is-locked') && (scrollX || scrollY) && scrollTo(0, 0);
scrollTo(0, 0);
addEventListener('scroll', pinTop, { passive: true });
addEventListener('pageshow', pinTop);
addEventListener('load', pinTop);

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

gsap.set(['.hero__title-main', '.hero__title-year', '.hero__eyebrow', '.hero__name', '.hero__meta li', '.countdown', '.hero__ctas > *', '.hero__scroll'], { opacity: 0 });
gsap.set('#nav', { opacity: 0, y: -90 });

// ───────────── footage, fireworks, soundtrack, lyrics ─────────────
const film = createFilm(document.querySelector('.intro__video'));
const header = createLoop(document.querySelector('.hero__video'), 'harbour');
createLoop(document.querySelector('.footer__video'), 'skyline', { lazy: true });
const fireworks = new Fireworks(document.querySelector('.hero__fireworks'), { sound, reduced });
const lyrics = createLyrics(document.querySelector('.lyrics'), { onCue: syncFireworks });
const song = createSong({ onStart: () => lyrics.play(), onPause: () => lyrics.pause() });
lyrics.attach(song.audio);
let revealed = false;
if (import.meta.env.DEV) {
  Object.assign(window.__ausmc, { song, film, fireworks, lyrics, sound });
  window.__harbourProbe = () => ({ running: !!sound.harbour?.src, gain: sound.harbour?.g ? +sound.harbour.g.gain.value.toFixed(3) : null, ctx: sound.ctx?.state, songPlaying: !song.audio.paused, songT: +song.audio.currentTime.toFixed(2) });
}

/** land the big shells exactly on the song's emphasis beats */
function syncFireworks(m, ms) {
  if (!revealed || !fireworks.active || reduced) return;
  const at = performance.now() + ms;
  const { W, H } = fireworks;
  fireworks.nextAuto = Math.max(fireworks.nextAuto, at + 900);
  const mid = () => W * (0.5 + (Math.random() - 0.5) * 0.36);
  if (m.b === 'again') {
    fireworks.launch({ burstAt: at, x: mid(), y: H * (0.12 + Math.random() * 0.14), size: m.last ? 1.75 : 1.35, type: m.last ? 'star' : ['peony', 'star', 'ring', 'chrys'][m.i % 4] });
    if (m.dur > 2.5) [0.9, 2.0, 3.3, 4.6].forEach((d, k) => fireworks.launch({ burstAt: at + d * 1000, size: 1.05, type: ['willow', 'peony', 'crackle', 'ring'][k] }));
    if (m.last) setTimeout(() => fireworks.volley(6, { size: 1.25 }), ms + 280);
  } else if (m.b === 'heart') {
    fireworks.launch({ burstAt: at + m.dur * 700, x: W * 0.5, y: H * 0.22, type: 'heart', size: 1.35, palette: ['255,45,85', '255,255,255'] });
  } else if (m.b === 'burst') {
    fireworks.launch({ burstAt: at, x: mid(), type: 'crackle', size: 1.15 });
  } else if (m.b === 'istart') {
    fireworks.launch({ burstAt: at + 150, x: mid(), type: 'ring', size: 1.25 });
  }
}

sound.preloadHarbour(`${import.meta.env.BASE_URL}media/harbour-ambience.m4a`);
sound.preloadFireworks(`${import.meta.env.BASE_URL}media/sfx/`);
sound.preloadVoice(`${import.meta.env.BASE_URL}media/sfx/winner.m4a`);
sound.preloadScenes(`${import.meta.env.BASE_URL}media/sfx/`);

// ?sfx — a small on-screen report of the sound samples, for testing on phones
if (new URLSearchParams(location.search).has('sfx')) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;max-height:38vh;overflow:hidden;margin:0;padding:8px 10px;font:10px/1.45 ui-monospace,Menlo,monospace;color:#d8e6ff;background:rgba(0,0,0,.8);border-radius:10px;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(box);
  document.addEventListener('ausmc:arrived', (e) => sound.note(`arrived at the map (${e.detail})`));
  setInterval(() => {
    box.textContent = [`audio ${sound.ctx?.state ?? 'not started'} · sound ${sound.enabled ? 'on' : 'off'}`, ...sound.diag.slice(-16)].join('\n');
  }, 400);
}
const HARBOUR_BED = 0.32; // level under the soundtrack

const tapSound = document.querySelector('.tap-sound');
async function startSong() {
  sound.harbourLevel(HARBOUR_BED, 2.5); // the harbour settles beneath the soundtrack
  if (await song.start()) return;
  // a browser refused autoplay: offer a single tap to start the soundtrack
  tapSound.hidden = false;
  gsap.fromTo(tapSound, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: spring({ bounce: 0.35 }) });
}
tapSound.addEventListener('click', async () => {
  sound.setEnabled(true);
  syncToggle();
  if (await song.start()) gsap.to(tapSound, { y: 60, opacity: 0, duration: 0.4, onComplete: () => (tapSound.hidden = true) });
});

// fireworks fade out smoothly as the visitor scrolls on toward the schedule
ScrollTrigger.create({
  trigger: '.hero',
  start: 'top top',
  end: '75% top',
  onUpdate: (self) => {
    const v = Math.pow(1 - self.progress, 1.6);
    sound.setFireworksVolume(v);
    sound.setTicksVolume(v); // the clock hushes as you leave it for the schedule
  },
});

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
try { if (!localStorage.getItem('ausmc:sound-known')) toggle.classList.add('is-hinting'); } catch { toggle.classList.add('is-hinting'); }
toggle.addEventListener('click', () => {
  toggle.classList.remove('is-hinting');
  try { localStorage.setItem('ausmc:sound-known', '1'); } catch { /* private mode */ }
  const on = !sound.enabled;
  sound.setEnabled(on);
  if (on) {
    sound.chime(81, { gain: 0.06, dur: 1.2 });
    sound.startHarbour({ level: revealed ? HARBOUR_BED : 1, fade: 1.5 });
    if (revealed) (song.started ? song.resume() : startSong());
    else if (song.started) song.resume();
  } else {
    song.pause();
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
  // everything that must play with sound later is unlocked inside this tap (iOS)
  sound.setEnabled(withSound);
  film.prime(withSound);
  if (withSound) song.prime();
  syncToggle();
  if (withSound) sound.tap();

  const r = btn.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, { count: withSound ? 36 : 16, speed: [120, 480], life: [0.4, 0.9], colors: ['white', 'ice', 'blue', 'red'], gravity: 120 });

  await gsap.timeline()
    .to(btn, { scale: 0.92, duration: 0.08, ease: 'power2.out' })
    .to(btn, { scale: 1, duration: 0.45, ease: spring({ bounce: 0.5 }) })
    .to(card, { scale: 1.08, opacity: 0, filter: 'blur(18px)', duration: 0.45, ease: 'power2.in' }, 0.08)
    .to(portal, { opacity: 0, duration: 0.4, ease: 'power1.inOut' }, 0.2);
  portal.remove();

  await logo.ready;
  intro.classList.add('is-active');
  // the harbour rises in one second before the logo assembly completes
  const harbour = () => withSound && sound.startHarbour({ level: 1, fade: 1.2 });
  const { skipped } = await playIntro({ logo, stage: intro, fx, bg, stars, reduced, onNearEnd: harbour });
  harbour(); // (no-op if already playing, e.g. when the logo was skipped)
  if (!skipped && !reduced) await playFilm(withSound);
  await revealPage();
}

// ───────────── 2b · through the badge, into the sky: the arrival ─────────────
// The soundtrack enters 2.97s into the arrival: 20% of the original 14.85s
// footage. The footage is now trimmed 4s at its end, so the entry point stays
// on the same moment of the jet pass.
const SONG_AT_SEC = 2.97;
const SKIP_AFTER = 6.2; // seconds into the footage before "Skip intro" appears
const MOBILE = matchMedia('(max-width: 720px)').matches;
const EARLY_FIREWORKS = 2; // phones: the welcome wave launches 2s before the arrival ends
const ANNOUNCE_BEFORE_END = 1; // "And the winner is…" one second before the flight lands

async function playFilm(withSound) {
  const filmEl = intro.querySelector('.intro__film');
  const dest = filmEl.querySelector('.intro__dest');
  const v = film.video;
  const skipBtn = intro.querySelector('.intro__skip');
  await film.ready(4500);

  let finish;
  let over = false;
  const done = new Promise((res) => (finish = res));
  const onSkip = () => { sound.tap(); finish('skip'); };
  const onKey = (e) => e.key === 'Escape' && onSkip();
  skipBtn.addEventListener('click', onSkip);
  addEventListener('keydown', onKey);
  v.addEventListener('ended', () => finish('ended'), { once: true });

  // frame-accurate watch of the footage: song entry + skip button
  let songIn = false;
  let skipShown = false;
  let earlyFw = false;
  let announced = false;
  const announce = () => {
    if (announced) return;
    announced = true;
    sound.announce();
  };
  const check = () => {
    const d = v.duration;
    if (d && !songIn && v.currentTime >= Math.min(SONG_AT_SEC, d * 0.5)) {
      songIn = true;
      if (sound.enabled) {
        lyrics.setCinema(true); // the opening lines play over the arrival
        startSong();
      }
    }
    if (MOBILE && !earlyFw && d && v.currentTime >= d - EARLY_FIREWORKS) {
      earlyFw = true; // shells climb behind the fading film and burst as the page appears
      fireworks.start({ welcome: !reduced });
    }
    if (d && v.currentTime >= d - ANNOUNCE_BEFORE_END) announce();
    if (!skipShown && v.currentTime >= SKIP_AFTER) {
      skipShown = true;
      skipBtn.classList.add('is-shown');
    }
  };
  const watch = () => {
    if (over) return;
    check();
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
  v.addEventListener('timeupdate', check); // backup when frames are throttled

  const tl = gsap.timeline();
  tl.call(() => sound.whoosh({ dur: 0.7, f0: 220, f1: 1600, gain: 0.09, pan0: 0, pan1: 0, wet: 0.35 }), null, 0);
  tl.to(logo.float, { scale: 3.4, opacity: 0, filter: 'blur(18px)', duration: 0.7, ease: 'power3.in' }, 0);
  tl.to(['.intro__caption', '.intro__rays'], { opacity: 0, y: -24, duration: 0.4, ease: 'power2.in' }, 0);
  tl.to(fx.c, { opacity: 0, duration: 0.3, onComplete: () => { fx.clear(); gsap.set(fx.c, { opacity: 1 }); } }, 0.1);
  tl.call(() => film.play(withSound), null, 0.35);
  // the kangaroo (three.js + model) loads quietly while the footage plays,
  // so it's ready the moment the page appears
  tl.call(() => setTimeout(prepareKangaroo, 1500), null, 0.35);
  tl.fromTo(filmEl, { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' }, 0.3);
  tl.fromTo(dest.children, { opacity: 0, y: 24, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.4, stagger: 0.18, ease: 'expo.out' }, 0.35 + 4.4);
  tl.to(dest, { opacity: 0, y: -14, filter: 'blur(8px)', duration: 1.1, ease: 'power2.in' }, 0.35 + 8.2);

  // safety net if the video never reports "ended"
  const guard = setTimeout(() => finish('timeout'), ((v.duration || 15) + 4) * 1000);
  const how = await done;
  over = true;
  announce(); // a skipped flight still lands with the announcement
  v.removeEventListener('timeupdate', check);
  clearTimeout(guard);
  skipBtn.removeEventListener('click', onSkip);
  removeEventListener('keydown', onKey);
  if (how === 'skip') {
    tl.progress(1, true);
    film.stop();
  }
}

// ───────────── 3 · Sydney at night: song, fireworks, the page ─────────────
// the countdown ticks on every second once it has appeared (hushed by scrolling away)
let clockTicks = -1;
document.addEventListener('ausmc:second', () => {
  if (clockTicks < 0) return;
  sound.clockTick(clockTicks++);
});

async function revealPage() {
  const slot = document.querySelector('.hero__slot');
  gsap.killTweensOf(logo.float);
  gsap.set(logo.float, { clearProps: 'all' });
  gsap.set(logo.root, { opacity: 0 });
  slot.appendChild(logo.root);
  revealed = true;
  prepareKangaroo(); // (already loading since the footage began, unless it was skipped)

  // (normally already playing since 20% into the arrival)
  lyrics.setCinema(false);
  if (sound.enabled && !song.playing) startSong();
  header.play();

  const tl = gsap.timeline();
  tl.set('.hero__media', { opacity: 1 }, 0);
  tl.to(intro, { opacity: 0, duration: reduced ? 0.6 : 1.4, ease: 'power2.inOut' }, 0.05);
  tl.to(bg, { level: 1, pulse: 0, duration: 1.6 }, 0);
  tl.to(stars, { level: 1, duration: 1.6 }, 0);
  tl.call(() => hero.reveal(), null, 0.45);
  tl.call(() => fireworks.start({ welcome: !reduced, heartAround: document.querySelector('.hero__slot') }), null, 0.4);
  tl.add(heroEnter({ reduced }), reduced ? 0.2 : 0.6);
  // the seconds reels have dropped in: the next rolls tick in the visitor's ears
  tl.call(() => (clockTicks = 0), null, (reduced ? 0.2 : 0.6) + 1.1);
  // the footage has faded away and the countdown has settled: in he leaps
  tl.call(kangarooVisit, null, 1.9);
  tl.to('#nav', { opacity: 1, y: 0, duration: 1.2, ease: spring({ bounce: 0.32 }) }, reduced ? 0.2 : 1.0);
  await tl;

  intro.remove();
  film.stop();
  root.classList.remove('is-locked');
  removeEventListener('scroll', pinTop);
  lenis?.start();
  ScrollTrigger.refresh();
  hero.activate();

  if (location.hash === '#competitors') {
    openCompetitorsPage({ history: false });
  } else {
    const hash = location.hash && document.querySelector(location.hash);
    if (hash) lenis ? lenis.scrollTo(hash, { offset: -90, duration: 1.8 }) : hash.scrollIntoView({ behavior: 'smooth' });
  }
  kangarooOnMap();
  kangarooTip();
}

// ───────────── a kangaroo drops by: once, a moment after the page appears ─────────────
let kangaroo = null;
function prepareKangaroo() {
  if (reduced || kangaroo) return;
  kangaroo = import('./components/kangaroo.js')
    .then((m) => m.loadKangaroo(`${import.meta.env.BASE_URL}media/3d/kangaroo.glb`).then((gltf) => ({ m, gltf })))
    .catch(() => null);
}
async function kangarooVisit() {
  const k = await kangaroo;
  const countdown = document.querySelector('.countdown');
  if (!k || !countdown) return;
  // it performs along the countdown's top edge: wait until that's on screen
  // (clear of the nav) and the tab is in front
  await new Promise((res) => {
    const check = () => {
      const top = countdown.getBoundingClientRect().top;
      if (document.hidden || top < 140 || top > innerHeight - 40) return;
      removeEventListener('scroll', check);
      document.removeEventListener('visibilitychange', check);
      res();
    };
    addEventListener('scroll', check, { passive: true });
    document.addEventListener('visibilitychange', check);
    check();
  });
  const manual = import.meta.env.DEV && location.search.includes('roo=manual');
  k.m.kangarooVisit({ gltf: k.gltf, countdown, obstacles: [...document.querySelectorAll('.hero__title-main, .hero__title-year')], manual }).catch(() => {});
}

// ───────────── the competitors: their own page, grown out of the schedule's button ─────────────
const cpEntry = document.querySelector('.cp-entry');
let competitorsPage = null;
const loadCompetitors = () => (competitorsPage ??= import('./components/competitors.js'));
function openCompetitorsPage({ history = true } = {}) {
  loadCompetitors().then((m) => m.openCompetitors({ from: cpEntry, lenis, history }));
}
cpEntry?.addEventListener('click', () => {
  sound.tap();
  openCompetitorsPage();
});
cpEntry?.addEventListener('pointerenter', loadCompetitors, { once: true }); // warm it up on hover
addEventListener('hashchange', () => location.hash === '#competitors' && revealed && openCompetitorsPage({ history: false }));
if (cpEntry) {
  // the flags on the button, once the browser has a quiet moment
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => {
    Promise.all([import('./lib/worldflags.js'), import('./data/participants.js')]).then(([{ flagUrl }, d]) => {
      cpEntry.querySelectorAll('.cp-entry__flags i').forEach((i) => (i.style.backgroundImage = `url("${flagUrl(i.dataset.f)}")`));
      cpEntry.querySelector('.cp-entry__meta').innerHTML = `<span>${d.COMPETITORS.length} therapists · ${d.NATIONS.length} nations</span><span class="cp-entry__cats"> · ${Object.keys(d.CATEGORIES).length} categories</span>`;
    });
  });
  if (!reduced) {
    gsap.fromTo(cpEntry, { opacity: 0, y: 26, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: spring({ bounce: 0.3 }), scrollTrigger: { trigger: cpEntry, start: 'top 92%', once: true } });
    gsap.fromTo(cpEntry.querySelectorAll('.cp-entry__flags i'), { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, stagger: 0.07, delay: 0.25, ease: spring({ bounce: 0.45 }), scrollTrigger: { trigger: cpEntry, start: 'top 92%', once: true } });
  }
}

// he also lives on top of the map frame, from the first time it's on screen
function kangarooOnMap() {
  const frame = document.querySelector('.venue__map');
  if (reduced || !frame) return;
  const io = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.intersectionRatio >= 0.55)) return;
    io.disconnect();
    const k = await kangaroo;
    if (!k) return;
    // let the frame finish springing into place first
    for (let i = 0; i < 40 && (Math.abs(gsap.getProperty(frame, 'scale') - 1) > 0.002 || Math.abs(gsap.getProperty(frame, 'y')) > 0.5); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const manual = import.meta.env.DEV && location.search.includes('roo=map');
    k.m.kangarooWander({ gltf: k.gltf, anchor: frame, obstacles: [...document.querySelectorAll('.venue .section-head > *')], uMax: 29, manual }).catch(() => {}); // 30% bigger than on the countdown
  }, { threshold: [0.55, 0.8] });
  io.observe(frame);
}

// …and when someone settles in to read the schedule, he leans in with a tip
// about the reminder bells (once, and only for visitors who haven't used one)
const ROO_LINE = `${import.meta.env.BASE_URL}media/sfx/roo-psst.m4a`;
function kangarooTip() {
  if (reduced) return;
  try { if (JSON.parse(localStorage.getItem('ausmc:reminders') || '[]').length) return; } catch { /* private mode */ }
  sound.preloadLine(ROO_LINE);
  let stop = null;
  const found = (e) => { if (e.target.closest('.remind')) disarm(); }; // already found the bells
  const disarm = () => {
    stop?.();
    document.removeEventListener('click', found);
  };
  document.addEventListener('click', found);
  stop = watchReading(async () => {
    disarm();
    const k = await kangaroo;
    const bell = pickBell();
    if (!k || !bell) return;
    const line = await sound.preloadLine(ROO_LINE);
    k.m.kangarooPeek({ gltf: k.gltf, bell, speak: () => sound.speak(line), ringBell }).catch(() => {});
  });
}
/** the reminder bell nearest where they're reading */
function pickBell() {
  const H = innerHeight;
  let best = null;
  let bestD = Infinity;
  document.querySelectorAll('.remind:not(.is-set)').forEach((b) => {
    const r = b.getBoundingClientRect();
    const y = r.top + r.height / 2;
    if (!r.width || y < H * 0.18 || y > H * 0.82) return;
    const d = Math.abs(y - H * 0.42);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  });
  return best;
}
/** a bell hinged at its top: a damped swing and a warm glow */
function ringBell(bell) {
  const icon = bell.querySelector(':scope > .i');
  const p = { t: 0 };
  sound.softPop({ pitch: 1.25, gain: 0.04 });
  gsap.to(p, {
    t: 1.2, duration: 1.2, ease: 'none',
    onUpdate: () => gsap.set(icon, { rotation: 22 * Math.exp(-3 * p.t) * Math.sin(2 * Math.PI * 4.6 * p.t), transformOrigin: '50% 12%' }),
    onComplete: () => gsap.set(icon, { clearProps: 'rotation' }),
  });
  gsap.timeline({ onComplete: () => gsap.set(bell, { clearProps: 'boxShadow' }) })
    .fromTo(bell, { boxShadow: 'inset 0 0 0 1px rgba(255,90,120,0), 0 0 0px 0px rgba(255,45,85,0)' }, { boxShadow: 'inset 0 0 0 1px rgba(255,120,145,0.75), 0 0 24px 4px rgba(255,45,85,0.7)', duration: 0.3, ease: 'power2.out' })
    .to(bell, { boxShadow: 'inset 0 0 0 1px rgba(255,90,120,0), 0 0 0px 0px rgba(255,45,85,0)', duration: 0.9, ease: 'power2.inOut' }, 0.9);
}

document.fonts?.ready.then(() => ScrollTrigger.refresh());
