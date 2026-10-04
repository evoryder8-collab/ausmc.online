import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { spring } from '../lib/spring.js';
import { sound } from '../lib/audio.js';
import { eventStart, eventEnd, liveState, timeText } from '../lib/time.js';
import { DEPTH } from './logo.js';

gsap.registerPlugin(ScrollTrigger);

// ───────────────────────── countdown ─────────────────────────

function buildCountdown(root) {
  const cells = root.querySelector('.countdown__cells');
  const label = root.querySelector('.countdown__label');
  const units = [
    ['d', 'Days'],
    ['h', 'Hours'],
    ['m', 'Minutes'],
    ['s', 'Seconds'],
  ];
  cells.innerHTML = units
    .map(([k, l]) => `<div class="cd" data-u="${k}"><div class="cd__num"><span class="cd__d"><i>0</i></span><span class="cd__d"><i>0</i></span></div><div class="cd__label">${l}</div></div>`)
    .join('');
  const digits = Object.fromEntries(units.map(([k]) => [k, [...cells.querySelectorAll(`[data-u="${k}"] .cd__d`)]]));
  const prev = {};

  const setDigit = (slot, ch, animate) => {
    const cur = slot.querySelector('i:last-child');
    if (cur && cur.textContent === ch) return;
    if (!animate) {
      slot.innerHTML = `<i>${ch}</i>`;
      return;
    }
    const n = document.createElement('i');
    n.textContent = ch;
    slot.appendChild(n);
    gsap.fromTo(n, { yPercent: 80, opacity: 0, filter: 'blur(4px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.6, ease: spring({ bounce: 0.3 }) });
    if (cur) gsap.to(cur, { yPercent: -80, opacity: 0, filter: 'blur(4px)', duration: 0.35, ease: 'power2.in', onComplete: () => cur.remove() });
  };

  let mode = '';
  const render = (animate = true) => {
    const now = new Date();
    if (now < eventStart) {
      if (mode !== 'pre') {
        mode = 'pre';
        label.textContent = 'The championship begins in';
        root.classList.remove('is-live', 'is-over');
      }
      let diff = Math.max(0, eventStart - now) / 1000;
      const vals = { d: Math.floor(diff / 86400), h: 0, m: 0, s: 0 };
      diff -= vals.d * 86400;
      vals.h = Math.floor(diff / 3600);
      diff -= vals.h * 3600;
      vals.m = Math.floor(diff / 60);
      vals.s = Math.floor(diff - vals.m * 60);
      for (const k of Object.keys(vals)) {
        const str = String(vals[k]).padStart(2, '0').slice(-2);
        if (prev[k] !== str) {
          digits[k].forEach((slot, i) => setDigit(slot, str[i], animate));
          prev[k] = str;
        }
      }
    } else if (now < eventEnd) {
      const { live, next } = liveState(now);
      const text = live.length ? `Live now · ${live[live.length - 1].title}` : next ? `Up next · ${next.title} at ${timeText(next.start)}` : 'The championship is underway';
      if (mode !== text) {
        mode = text;
        root.classList.add('is-live');
        label.innerHTML = '<span class="live-dot"></span> Happening now';
        cells.innerHTML = `<p class="countdown__now">${text}</p>`;
      }
    } else if (mode !== 'over') {
      mode = 'over';
      root.classList.add('is-over');
      label.textContent = 'AusMC 2026 · That’s a wrap';
      cells.innerHTML = '<p class="countdown__now">Thank you, Sydney. See you at the next edition.</p>';
    }
  };
  render(false);
  setInterval(render, 1000);
}

// ───────────────────────── badge life ─────────────────────────

export function initHero({ logo, reduced }) {
  buildCountdown(document.querySelector('.countdown'));

  const hero = document.querySelector('.hero');
  const finePointer = matchMedia('(pointer: fine)').matches;

  return {
    /** Called once the badge has landed in its hero slot */
    activate() {
      if (reduced) return;
      // separate the layers in depth so tilting reveals real parallax
      Object.entries(logo.pieces).forEach(([id, el]) => {
        gsap.to(el, { z: DEPTH[id] || 0, duration: 1.6, ease: spring({ bounce: 0.25 }), delay: 0.1 });
      });

      gsap.to(logo.float, { y: -16, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(logo.glow, { scale: 1.08, opacity: 0.85, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      if (finePointer) {
        const rx = gsap.quickTo(logo.tilt, 'rotationX', { duration: 1.1, ease: 'power3' });
        const ry = gsap.quickTo(logo.tilt, 'rotationY', { duration: 1.1, ease: 'power3' });
        addEventListener('pointermove', (e) => {
          const r = hero.getBoundingClientRect();
          if (r.bottom < 0) return;
          const nx = e.clientX / innerWidth - 0.5;
          const ny = e.clientY / innerHeight - 0.5;
          ry(nx * 30);
          rx(-ny * 22);
        }, { passive: true });
      } else {
        gsap.fromTo(logo.tilt, { rotationY: -14, rotationX: 6 }, { rotationY: 14, rotationX: -6, duration: 4.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }

      // a gleam every few seconds
      const band = logo.gleam.firstElementChild;
      const gleam = () => {
        if (document.hidden || hero.getBoundingClientRect().bottom < 0) return;
        gsap.fromTo(band, { xPercent: -160 }, { xPercent: 160, duration: 1.3, ease: 'power2.inOut' });
        gsap.fromTo(logo.rim, { opacity: 0, rotation: -100 }, { opacity: 0.9, rotation: 260, duration: 1.8, ease: 'power2.inOut', onComplete: () => gsap.to(logo.rim, { opacity: 0, duration: 0.5 }) });
      };
      setInterval(gleam, 7000);

      // scroll: the badge drifts back, title lifts
      gsap.to('.hero__visual', {
        yPercent: 18,
        scale: 0.86,
        opacity: 0.35,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to('.hero__copy', {
        yPercent: -10,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: '35% top', end: 'bottom top', scrub: 0.6 },
      });
    },
  };
}

export function heroEnter({ reduced }) {
  const tl = gsap.timeline();
  const items = ['.hero__eyebrow', '.hero__name', '.hero__meta li', '.countdown', '.hero__ctas > *', '.hero__scroll'];
  if (reduced) {
    tl.to(['.hero__title-main', '.hero__title-year', ...items], { opacity: 1, y: 0, duration: 0.6, stagger: 0.04 });
    return tl;
  }
  tl.fromTo('.hero__title-main', { '--w': 62, opacity: 0, y: 40, filter: 'blur(12px) drop-shadow(0px 10px 40px rgba(60,100,255,0))' }, { '--w': 125, opacity: 1, y: 0, filter: 'blur(0px) drop-shadow(0px 10px 40px rgba(60,100,255,0.35))', duration: 1.6, ease: 'expo.out' }, 0);
  tl.fromTo('.hero__title-year', { opacity: 0, y: 30, rotation: -6, filter: 'blur(10px) drop-shadow(0px 8px 36px rgba(228,0,43,0))' }, { opacity: 1, y: 0, rotation: 0, filter: 'blur(0px) drop-shadow(0px 8px 36px rgba(228,0,43,0.45))', duration: 1.3, ease: spring({ bounce: 0.3 }) }, 0.25);
  tl.fromTo(items, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: spring({ bounce: 0.28 }), stagger: 0.07 }, 0.3);
  tl.call(() => {
    document.querySelectorAll('.cd').forEach((c, i) => gsap.fromTo(c, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, delay: i * 0.06, ease: spring({ bounce: 0.45 }) }));
    sound.chime(81, { gain: 0.05, dur: 1.5 });
  }, null, 0.6);
  return tl;
}
