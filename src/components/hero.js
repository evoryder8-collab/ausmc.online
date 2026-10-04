import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { spring } from '../lib/spring.js';
import { eventStart, eventEnd, liveState, timeText, SYD, tzState, setTzMode, localZone, localDiffers, offsetMinutes, zoneCity } from '../lib/time.js';
import { nearestPlace } from '../lib/places.js';
import { sound } from '../lib/audio.js';
import { DEPTH } from './logo.js';

gsap.registerPlugin(ScrollTrigger);

// ───────────────────────── odometer countdown ─────────────────────────
// Every digit is a reel. Counting down, the next (smaller) value rolls in
// from above with a spring; wraps (0 → 9 / 5 / 2) roll through a helper slot.

function reel(max) {
  const el = document.createElement('span');
  el.className = 'reel';
  const strip = document.createElement('span');
  strip.className = 'reel__strip';
  const helper = document.createElement('i');
  helper.textContent = String(max);
  strip.appendChild(helper);
  for (let d = 0; d <= 9; d++) {
    const i = document.createElement('i');
    i.textContent = String(d);
    strip.appendChild(i);
  }
  el.appendChild(strip);
  let cur = -1;
  const step = () => strip.firstElementChild.getBoundingClientRect().height || 1;
  return {
    el,
    set(v, animate) {
      if (v === cur) return;
      const prev = cur;
      cur = v;
      const h = step();
      if (!animate || prev < 0) {
        gsap.set(strip, { y: -(v + 1) * h });
        return;
      }
      gsap.killTweensOf(strip);
      if (v > prev) {
        helper.textContent = String(v);
        gsap.timeline()
          .fromTo(strip, { y: -(prev + 1) * h }, { y: 0, duration: 0.75, ease: spring({ bounce: 0.32 }) })
          .set(strip, { y: -(v + 1) * h });
      } else {
        gsap.fromTo(strip, { y: -(prev + 1) * h }, { y: -(v + 1) * h, duration: 0.75, ease: spring({ bounce: 0.32 }) });
      }
      gsap.fromTo(strip, { filter: 'blur(2.5px)' }, { filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' });
    },
    refresh() {
      if (cur >= 0) gsap.set(strip, { y: -(cur + 1) * step() });
    },
  };
}

function buildCountdown(root) {
  const cells = root.querySelector('.countdown__cells');
  const label = root.querySelector('.countdown__label');
  const nowEl = root.querySelector('.countdown__now');
  const sweep = root.querySelector('.countdown__sweep span');
  const units = [
    ['d', 'Days', [9, 9]],
    ['h', 'Hours', [2, 9]],
    ['m', 'Minutes', [5, 9]],
    ['s', 'Seconds', [5, 9]],
  ];
  const reels = {};
  cells.innerHTML = '';
  units.forEach(([k, l, maxes], idx) => {
    const cell = document.createElement('div');
    cell.className = `cd cd--${k}`;
    const num = document.createElement('div');
    num.className = 'cd__num';
    reels[k] = maxes.map((mx) => reel(mx));
    reels[k].forEach((r) => num.appendChild(r.el));
    const lab = document.createElement('div');
    lab.className = 'cd__label';
    lab.textContent = l;
    cell.append(num, lab);
    cells.appendChild(cell);
    if (idx < units.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'cd__sep';
      sep.innerHTML = '<i></i><i></i>';
      cells.appendChild(sep);
    }
  });
  addEventListener('resize', () => Object.values(reels).flat().forEach((r) => r.refresh()));
  document.fonts?.ready.then(() => Object.values(reels).flat().forEach((r) => r.refresh()));

  const mk = (tz, o) => new Intl.DateTimeFormat('en-AU', tz ? { ...o, timeZone: tz } : o);
  const CLOCK = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' };
  const sydClock = mk(SYD, CLOCK);
  const localClock = mk(undefined, CLOCK);
  const sydShort = mk(SYD, { hour: 'numeric', minute: '2-digit', hour12: true });
  const localStart = mk(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const up = (str) => str.replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());
  const whereEl = root.querySelector('.countdown__where');
  const altEl = root.querySelector('.countdown__alt');
  const localBtn = root.querySelector('.local-btn');
  const localLabel = localBtn?.querySelector('span:last-child');
  const lg = label.querySelector('.lg');
  const sm = label.querySelector('.sm');
  const LG = lg?.textContent;
  const SM = sm?.textContent;
  let placeName = '';
  let mode = '';

  const applyZone = () => {
    const local = tzState.mode === 'local';
    root.classList.toggle('is-localtime', local);
    if (whereEl) whereEl.textContent = local ? `Your time${placeName ? ` · ${placeName}` : ''}` : 'Sydney now';
    if (localLabel) localLabel.textContent = local ? 'Back to Sydney time' : 'Check your local time';
    if (lg && sm) {
      const when = up(localStart.format(eventStart));
      lg.textContent = local ? `Day 1 begins ${when} your time` : LG;
      sm.textContent = local ? `Day 1 · ${when} your time` : SM;
    }
    if (altEl) altEl.hidden = !local;
  };
  document.addEventListener('ausmc:tz', applyZone);

  const locate = () => new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition((p) => res(p.coords), () => res(null), { enableHighAccuracy: false, timeout: 9000, maximumAge: 6 * 3600 * 1000 });
  });

  localBtn?.addEventListener('click', async () => {
    sound.tap();
    if (tzState.mode === 'local') return setTzMode('sydney');
    if (!localDiffers) {
      localLabel.textContent = 'You’re already on Sydney time';
      setTimeout(applyZone, 2600);
      return;
    }
    localBtn.classList.add('is-busy');
    localLabel.textContent = 'Finding your time…';
    // the browser asks for location; coordinates never leave the device
    const coords = await locate();
    const myOffset = offsetMinutes(localZone);
    const near = coords && nearestPlace(coords, (tz) => offsetMinutes(tz) === myOffset);
    placeName = near ? near.name : zoneCity(localZone);
    localBtn.classList.remove('is-busy');
    setTzMode('local');
    applyZone();
    gsap.fromTo(root.querySelectorAll('.countdown__clock, .countdown__alt, .countdown__label'), { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, stagger: 0.06, ease: spring({ bounce: 0.25 }) });
  });
  let lastSec = -1;

  const render = (animate = true) => {
    const now = new Date();
    const local = tzState.mode === 'local';
    if (nowEl) nowEl.textContent = up((local ? localClock : sydClock).format(now));
    if (local && altEl) {
      const diff = (offsetMinutes(SYD, now) - offsetMinutes(localZone, now)) / 60;
      const h = Math.abs(diff);
      const hTxt = `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
      altEl.textContent = `Sydney ${up(sydShort.format(now))} · ${diff === 0 ? 'same time as you' : `Sydney is ${hTxt} ${diff > 0 ? 'ahead of' : 'behind'} you`}`;
    }
    if (now < eventStart) {
      if (mode !== 'pre') {
        mode = 'pre';
        root.classList.remove('is-live', 'is-over');
      }
      let diff = Math.max(0, Math.floor((eventStart - now) / 1000));
      const vals = { d: Math.floor(diff / 86400) };
      diff -= vals.d * 86400;
      vals.h = Math.floor(diff / 3600);
      diff -= vals.h * 3600;
      vals.m = Math.floor(diff / 60);
      vals.s = diff - vals.m * 60;
      for (const k of Object.keys(vals)) {
        const str = String(Math.min(99, vals[k])).padStart(2, '0');
        reels[k][0].set(+str[0], animate);
        reels[k][1].set(+str[1], animate);
      }
      if (vals.s !== lastSec && animate) {
        lastSec = vals.s;
        const cell = cells.querySelector('.cd--s');
        cell.classList.remove('is-tick');
        void cell.offsetWidth;
        cell.classList.add('is-tick');
        if (vals.s === 0) {
          root.classList.remove('is-minute');
          void root.offsetWidth;
          root.classList.add('is-minute');
        }
      }
    } else if (now < eventEnd) {
      const { live, next } = liveState(now);
      const text = live.length ? `Live now · ${live[live.length - 1].title}` : next ? `Up next · ${next.title} at ${timeText(next.start)}` : 'The championship is underway';
      if (mode !== text) {
        mode = text;
        root.classList.add('is-live');
        label.innerHTML = '<span class="live-dot"></span> Happening now in Sydney';
        cells.innerHTML = `<p class="countdown__live">${text}</p>`;
      }
    } else if (mode !== 'over') {
      mode = 'over';
      root.classList.add('is-over');
      label.textContent = 'AusMC 2026 · That’s a wrap';
      cells.innerHTML = '<p class="countdown__live">Thank you, Sydney. See you at the next edition.</p>';
    }
  };

  // a hairline "second hand" sweeping continuously in step with the clock
  const sweepTick = () => {
    if (sweep && mode === 'pre') sweep.style.transform = `scaleX(${(Date.now() % 1000) / 1000})`;
    requestAnimationFrame(sweepTick);
  };
  requestAnimationFrame(sweepTick);

  render(false);
  // align to the real second boundary so digits roll exactly on the tick
  setTimeout(() => {
    render();
    setInterval(render, 1000);
  }, 1000 - (Date.now() % 1000) + 8);
}

// ───────────────────────── badge life ─────────────────────────

export function initHero({ logo, reduced }) {
  buildCountdown(document.querySelector('.countdown'));
  const hero = document.querySelector('.hero');
  const finePointer = matchMedia('(pointer: fine)').matches;

  return {
    /** the badge drops into the hero, its layers settling into depth */
    reveal() {
      if (reduced) {
        gsap.fromTo(logo.root, { opacity: 0 }, { opacity: 1, duration: 0.6 });
        return;
      }
      gsap.set(logo.root, { opacity: 1 });
      gsap.fromTo(logo.float, { scale: 0.5, y: -50, rotationX: 50, opacity: 0 }, { scale: 1, y: 0, rotationX: 0, opacity: 1, duration: 1.6, ease: spring({ bounce: 0.35 }) });
      Object.entries(logo.pieces).forEach(([id, el], k) => {
        gsap.fromTo(el, { z: (DEPTH[id] || 0) * 5 + 140 }, { z: DEPTH[id] || 0, duration: 1.5, delay: 0.08 + k * 0.03, ease: spring({ bounce: 0.3 }) });
      });
      gsap.fromTo(logo.glow, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1.6, ease: 'power2.out' });
    },

    activate() {
      if (reduced) return;
      gsap.to(logo.float, { y: -10, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(logo.glow, { scale: 1.08, opacity: 0.85, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      if (finePointer) {
        const rx = gsap.quickTo(logo.tilt, 'rotationX', { duration: 1.1, ease: 'power3' });
        const ry = gsap.quickTo(logo.tilt, 'rotationY', { duration: 1.1, ease: 'power3' });
        addEventListener('pointermove', (e) => {
          if (hero.getBoundingClientRect().bottom < 0) return;
          ry((e.clientX / innerWidth - 0.5) * 34);
          rx(-(e.clientY / innerHeight - 0.5) * 24);
        }, { passive: true });
      } else {
        gsap.fromTo(logo.tilt, { rotationY: -16, rotationX: 6 }, { rotationY: 16, rotationX: -6, duration: 4.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }
      const band = logo.gleam.firstElementChild;
      setInterval(() => {
        if (document.hidden || hero.getBoundingClientRect().bottom < 0) return;
        gsap.fromTo(band, { x: 0, xPercent: -160 }, { x: 0, xPercent: 160, duration: 1.3, ease: 'power2.inOut' });
        gsap.fromTo(logo.rim, { opacity: 0, rotation: -100 }, { opacity: 0.9, rotation: 260, duration: 1.8, ease: 'power2.inOut', onComplete: () => gsap.to(logo.rim, { opacity: 0, duration: 0.5 }) });
      }, 7000);

      // scroll: the night sky pushes in and dims while the content lifts away
      const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 };
      gsap.to('.hero__video', { scale: 1.12, ease: 'none', scrollTrigger: st });
      gsap.to('.hero__dim', { opacity: 0.7, ease: 'none', scrollTrigger: { ...st } });
      gsap.to('.hero__inner', { yPercent: -10, opacity: 0.15, ease: 'none', scrollTrigger: { ...st, start: '30% top' } });
    },
  };
}

export function heroEnter({ reduced }) {
  const tl = gsap.timeline();
  const items = ['.hero__eyebrow', '.hero__name', '.countdown', '.hero__meta li', '.hero__ctas > *', '.hero__scroll'];
  if (reduced) {
    tl.to(['.hero__title-main', '.hero__title-year', ...items], { opacity: 1, y: 0, duration: 0.6, stagger: 0.04 });
    return tl;
  }
  tl.fromTo('.hero__title-main', { '--w': 62, opacity: 0, y: 40, filter: 'blur(12px) drop-shadow(0px 10px 40px rgba(60,100,255,0))' }, { '--w': 125, opacity: 1, y: 0, filter: 'blur(0px) drop-shadow(0px 10px 40px rgba(60,100,255,0.35))', duration: 1.6, ease: 'expo.out' }, 0.15);
  tl.fromTo('.hero__title-year', { '--w': 62, opacity: 0, y: 40, filter: 'blur(12px) drop-shadow(0px 10px 32px rgba(228,0,43,0))' }, { '--w': 125, opacity: 1, y: 0, filter: 'blur(0px) drop-shadow(0px 10px 32px rgba(228,0,43,0.32))', duration: 1.6, ease: 'expo.out' }, 0.3);
  tl.fromTo(items, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: spring({ bounce: 0.28 }), stagger: 0.07 }, 0.4);
  tl.call(() => {
    document.querySelectorAll('.reel').forEach((r, i) => gsap.fromTo(r, { yPercent: -70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, delay: i * 0.05, ease: spring({ bounce: 0.4 }) }));
  }, null, 0.65);
  return tl;
}
