import { gsap } from 'gsap';
import { CUES, AUDIO_OFFSET } from '../data/lyrics.js';
import { spring } from '../lib/spring.js';

// Kinetic lyrics for "Run It Down Again".
// • Every phrase is a small GSAP timeline that is *scrubbed* by the song clock
//   each frame (never free-running), so it stays locked to the audio.
// • Attack/release adapt to how tight the surrounding phrases are; the song's
//   opening is summoned slowly, lone "again." beats hit fast and centred.
// • Movement, size and placement follow what the words mean.
// • The layer sits behind the page content and a free-space search keeps
//   phrases away from the schedule, buttons and text.

const AVOID = [
  '.nav__pill', '.hero__slot', '.hero__eyebrow', '.hero__title', '.hero__name', '.countdown', '.hero__meta', '.hero__ctas',
  '.daynav', '.tz', '.section-head__kicker', '.section-head__title', '.day__meta', '.block', '.venue__map', '.venue__panel',
  '.footer__mark', '.footer__line', '.footer__small', '.footer__top', '.live-toast', '.schedule__note',
].join(',');

// while the opening plays over the plane footage only the arrival title matters
const AVOID_CINEMA = '.intro__dest strong, .intro__dest span, .intro__dest small, .intro__skip.is-shown';
let cinema = false;

// Safari/WebKit (every iPhone browser) draws each filtered word as its own
// layer and clips the soft text-shadow to a visible box, so no blur there.
const WEBKIT = (() => {
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (/Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua));
})();
const BL = (px) => (WEBKIT ? 'none' : `blur(${px}px)`);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const edgePad = () => (innerWidth < 720 ? 10 : 20);

/** the largest scale (≤ max) that keeps an element inside the screen width */
function fitScale(el, max) {
  const r = el.getBoundingClientRect();
  if (!r.width) return max;
  const cx = r.left + r.width / 2;
  const room = Math.min(cx - edgePad(), innerWidth - edgePad() - cx);
  return clamp((room * 2) / r.width, 1, max);
}
const rnd = (a, b) => a + Math.random() * (b - a);

function behaviorFor(text) {
  const t = text.toLowerCase();
  const rules = [
    [/^again\.?$/, 'again'], [/run it down/, 'run'], [/how long/, 'long'], [/i don't care/, 'care'],
    [/friends all talk/, 'chatter'], [/office/, 'window'], [/clocking/, 'clock'], [/chasing/, 'chase'],
    [/flyers/, 'flutter'], [/tiny print/, 'tiny'], [/three kids/, 'pop'], [/one bar/, 'bar'], [/all in/, 'allin'],
    [/oh yeah/, 'burst'], [/\bfall\b/, 'fall'], [/stand/, 'stand'], [/scraped/, 'scrape'], [/shaking/, 'shake'],
    [/drawing/, 'draw'], [/"no"/, 'no'], [/wear it/, 'wear'], [/second skin/, 'skin'], [/foolish/, 'foolish'],
    [/gone/, 'gone'], [/punchline/, 'punch'], [/wrong song/, 'wrong'], [/keep on choosing/, 'choose'],
    [/heart/, 'heart'], [/losing is losing/, 'losing'], [/never start/, 'start'], [/and they say/, 'whisper'],
    [/had enough/, 'enough'], [/that's the day/, 'day'], [/^i start/, 'istart'],
  ];
  for (const [re, b] of rules) if (re.test(t)) return b;
  return 'drift';
}

const FONT = {
  serif: ['care', 'skin', 'whisper', 'foolish', 'tiny', 'day'],
  big: ['again'],
};

// per-cue timing: attack from the gap before, release from the gap after
const META = CUES.map((c, i) => {
  const b = behaviorFor(c.t);
  const dur = c.e - c.s;
  const prevEnd = i ? CUES[i - 1].e : -10;
  const nextStart = CUES[i + 1]?.s ?? Infinity;
  const gapB = c.s - prevEnd;
  const gapA = nextStart - c.e;
  let A = clamp(0.14 + gapB * 0.3, 0.14, 0.85);
  if (i < 3) A = Math.max(A, 0.62); // the song's opening is summoned slowly
  if (dur / c.t.length < 0.05) A = Math.min(A, 0.2); // dense, fast-sung line
  A = Math.min(A, dur * 0.45);
  if (b === 'again') A = Math.min(0.13, dur * 0.3);
  if (b === 'burst') A = 0.07;
  const tight = gapA < 0.2;
  const lead = tight ? Math.min(0.13, dur * 0.15) : 0;
  const tail = tight ? 0.16 : clamp(gapA * 0.55, 0.28, 0.95);
  return { i, ...c, b, dur, A, lead, tail, total: dur + tail, exitAt: dur - lead, R: lead + tail, last: i === CUES.length - 1 };
});

function buildDom(text, b) {
  const el = document.createElement('div');
  el.className = `ly ly--${b}${FONT.serif.includes(b) ? ' ly--serif' : ' ly--display'}`;
  const duck = document.createElement('div');
  duck.className = 'ly__duck';
  const inner = document.createElement('div');
  inner.className = 'ly__in';
  const words = [];
  const chars = [];
  text.split(' ').forEach((w, wi, arr) => {
    const ws = document.createElement('span');
    ws.className = 'lw';
    ws.dataset.w = w.toLowerCase().replace(/[^a-z']/g, '');
    for (const ch of w) {
      const cs = document.createElement('span');
      cs.className = 'lc';
      cs.textContent = ch;
      ws.appendChild(cs);
      chars.push(cs);
    }
    inner.appendChild(ws);
    words.push(ws);
    // spaces are elements, not bare text nodes: GSAP briefly re-parents
    // detached nodes to measure transforms and re-inserts them before the next
    // *element*, which would otherwise hop each word over its own space
    if (wi < arr.length - 1) {
      const sp = document.createElement('span');
      sp.className = 'lsp';
      sp.textContent = ' ';
      inner.appendChild(sp);
    }
  });
  duck.appendChild(inner);
  el.appendChild(duck);
  return { el, inner, words, chars, word: (k) => words.find((w) => w.dataset.w === k) };
}

// ───────────── reusable motion pieces ─────────────
const S = (bounce, velocity = 0) => spring({ bounce, velocity });

function inParts(tl, parts, A, from, { ease = S(0.32), at = 0, settle = 1 } = {}) {
  if (!parts.length) return;
  const n = parts.length;
  const d = Math.max(0.12, A * 0.7);
  const st = n > 1 ? Math.max(0, (A - d * 0.5) / (n - 1)) : 0;
  const { opacity: _o, filter, ...motion } = from;
  tl.fromTo(parts, { opacity: 0, filter: filter || BL(0) }, { opacity: 1, filter: BL(0), duration: d * 0.8, stagger: st, ease: 'power2.out' }, at);
  if (Object.keys(motion).length) {
    const to = Object.fromEntries(Object.keys(motion).map((k) => [k, k.startsWith('scale') ? 1 : 0]));
    tl.fromTo(parts, motion, { ...to, duration: d * 1.6 * settle, stagger: st, ease }, at);
  }
}

function outParts(tl, parts, at, R, to = {}) {
  tl.to(parts, { opacity: 0, filter: BL(8), y: '-=12', duration: R, stagger: parts.length > 1 ? Math.min(0.03, R / parts.length / 2) : 0, ease: 'power2.in', ...to }, at);
}

/** deterministic tremble that survives scrubbing */
function jitter(tl, target, at, dur, amp, freq = 1) {
  const p = { v: 0 };
  const set = gsap.quickSetter(target, 'css');
  tl.to(p, {
    v: 1, duration: dur, ease: 'none',
    onUpdate() {
      const t = p.v * dur * freq;
      set({ x: Math.sin(t * 61) * amp + Math.sin(t * 23) * amp * 0.6, y: Math.cos(t * 47) * amp * 0.7, rotation: Math.sin(t * 37) * amp * 0.4 });
    },
  }, at);
}

function build(m, base) {
  const d = buildDom(m.t, m.b);
  const { el, inner, words, chars, word } = d;
  const tl = gsap.timeline({ paused: true });
  const { A, dur, exitAt, R } = m;
  const hold = Math.max(0.05, exitAt - A);
  let pref = 'any';
  let size = base;
  tl.set(el, { autoAlpha: 1 }, 0);

  switch (m.b) {
    case 'care':
      size = base * 1.1;
      inParts(tl, words, A, { y: 18, filter: BL(12) }, { ease: 'power3.out' });
      tl.to(el, { x: '+=22', rotation: -2.5, duration: m.total, ease: 'sine.inOut' }, 0);
      outParts(tl, words, exitAt, R);
      break;

    case 'long': {
      el.dataset.grow = '0.28';
      inParts(tl, chars, A, { y: 22, filter: BL(8) });
      const lw = word('long');
      if (lw) tl.fromTo(lw, { '--w': 85 }, { '--w': 125, duration: Math.max(0.3, dur - A * 0.5), ease: 'sine.inOut' }, A * 0.5);
      tl.fromTo(inner, { letterSpacing: '0em' }, { letterSpacing: '0.07em', duration: dur, ease: 'none' }, 0);
      outParts(tl, chars, exitAt, R);
      break;
    }

    case 'run': {
      pref = 'left';
      el.dataset.reach = String(Math.round(base * 2.3)); // room for the run across + its exit
      el.classList.add('ly--skew');
      tl.fromTo(words, { x: -base * 1.4, opacity: 0, filter: BL(12) }, { x: 0, opacity: 1, filter: BL(0), duration: Math.max(0.18, A * 0.85), stagger: A * 0.15 / words.length, ease: 'expo.out' }, 0);
      tl.to(el, { x: `+=${base * 1.6}`, duration: dur, ease: 'none' }, 0);
      const dn = word('down');
      if (dn) tl.to(dn, { y: base * 0.38, rotation: 7, duration: Math.max(0.2, hold), ease: 'power2.in' }, A);
      tl.to(words, { x: `+=${base * 0.6}`, opacity: 0, filter: BL(12), duration: R, stagger: 0.025, ease: 'power2.in' }, exitAt);
      break;
    }

    case 'again': {
      pref = 'center';
      size = base * (m.last ? 3.3 : 2.7);
      const long = dur > 2.5;
      if (long) el.dataset.grow = '0.45';
      tl.fromTo(inner, { opacity: 0, filter: BL(16) }, { opacity: 1, filter: BL(0), duration: Math.max(0.08, A), ease: 'power2.out' }, 0);
      tl.fromTo(inner, { scale: 1.75 }, { scale: 1, duration: Math.min(0.75, Math.max(0.3, dur * 0.8)), ease: S(0.42) }, 0);
      if (long) {
        tl.to(inner, { scale: 1.2, duration: hold, ease: 'sine.inOut' }, A + 0.5);
        tl.fromTo(inner, { letterSpacing: '0em' }, { letterSpacing: '0.16em', duration: dur, ease: 'sine.out' }, 0);
        for (let k = 0; k < 3; k++) {
          const g = inner.cloneNode(true);
          g.className = 'ly__ghost';
          inner.parentNode.appendChild(g);
          const start = 0.25 + k * Math.max(0.6, (dur - 1.5) / 3);
          tl.fromTo(g, { opacity: 0.55, scale: 1 }, { opacity: 0, scale: () => fitScale(g, 1.9), duration: 2.6, ease: 'power2.out' }, start);
        }
      } else {
        const g = inner.cloneNode(true);
        g.className = 'ly__ghost';
        inner.parentNode.appendChild(g);
        tl.fromTo(g, { opacity: 0.6, scale: 1 }, { opacity: 0, scale: () => fitScale(g, 1.7), duration: 0.9, ease: 'power2.out' }, 0.04);
      }
      tl.to(inner, { opacity: 0, scale: '+=0.18', filter: BL(14), duration: R, ease: 'power2.in' }, exitAt);
      break;
    }

    case 'chatter':
      words.forEach((w, k) => gsap.set(w, { y: (k % 2 ? 1 : -1) * base * 0.18 }));
      inParts(tl, words, A, { scale: 0.3 }, { ease: S(0.55) });
      words.forEach((w, k) => tl.to(w, { y: `+=${(k % 2 ? -1 : 1) * base * 0.12}`, duration: 0.22, repeat: Math.max(1, Math.floor(hold / 0.22) - 1), yoyo: true, ease: 'sine.inOut' }, A + k * 0.07));
      outParts(tl, words, exitAt, R);
      break;

    case 'window':
      tl.fromTo(words, { clipPath: 'inset(-10% 100% -10% 0%)', opacity: 1 }, { clipPath: 'inset(-10% 0% -10% 0%)', duration: Math.max(0.15, A * 0.8), stagger: A * 0.25 / words.length, ease: 'power2.inOut' }, 0);
      tl.to(words, { clipPath: 'inset(-10% 0% -10% 100%)', duration: R, stagger: 0.03, ease: 'power2.in' }, exitAt);
      break;

    case 'clock': {
      tl.fromTo(inner, { rotation: -80, transformOrigin: '0% 60%', opacity: 0 }, { rotation: 0, opacity: 1, duration: Math.max(0.5, A * 2), ease: S(0.4) }, 0);
      const late = word('late');
      if (late) tl.to(late, { x: base * 0.4, opacity: 0.7, duration: hold, ease: 'sine.out' }, A);
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'chase':
      inParts(tl, words, A, { x: -base * 1.2, filter: BL(10) }, { ease: 'expo.out' });
      words.forEach((w, k) => tl.to(w, { x: base * (0.15 + k * 0.25), duration: hold, ease: 'none' }, A));
      if (word('new')) tl.fromTo(word('new'), { textShadow: '0 0 0px rgba(255,255,255,0)' }, { textShadow: '0 0 26px rgba(160,190,255,1)', duration: 0.5, yoyo: true, repeat: 1 }, A + hold * 0.4);
      tl.to(words, { x: `+=${base * 1.2}`, opacity: 0, filter: BL(10), duration: R, stagger: 0.04, ease: 'power3.in' }, exitAt);
      break;

    case 'flutter':
      words.forEach((w) => gsap.set(w, { transformPerspective: 500 }));
      inParts(tl, words, A, { rotationX: -95, rotation: rnd(-14, 14), y: -10 }, { ease: S(0.45) });
      tl.to(inner, { rotation: 2.5, duration: 0.6, yoyo: true, repeat: Math.max(1, Math.floor(hold / 0.6)), ease: 'sine.inOut' }, A);
      tl.to(words, { y: base * 1.4, rotationX: 70, rotation: () => rnd(-25, 25), opacity: 0, duration: R + 0.2, stagger: 0.05, ease: 'power2.in' }, exitAt);
      break;

    case 'tiny': {
      pref = 'corner';
      size = base * 0.95;
      ['tiny', 'print'].forEach((k) => word(k)?.classList.add('ly-tiny'));
      inParts(tl, words.slice(0, 3), A, { y: 12, filter: BL(8) }, { ease: 'power3.out' });
      const tinyChars = [...el.querySelectorAll('.ly-tiny .lc')];
      tl.fromTo(tinyChars, { opacity: 0 }, { opacity: 1, duration: 0.01, stagger: Math.min(0.06, hold / tinyChars.length / 2) }, A * 0.8);
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'pop':
      inParts(tl, words, A, { scale: 0.2, y: 10 }, { ease: S(0.6) });
      outParts(tl, words, exitAt, R);
      break;

    case 'bar': {
      const bar = document.createElement('span');
      bar.className = 'ly-bar';
      inner.appendChild(bar);
      inParts(tl, words, A, { y: 14 });
      tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: Math.max(0.3, hold * 0.6), ease: 'power3.out' }, A * 0.5);
      outParts(tl, [inner], exitAt, R);
      break;
    }

    case 'allin':
      ['all', 'in'].forEach((k) => word(k)?.classList.add('ly-strong'));
      inParts(tl, words, A, { scale: 1.5, filter: BL(10) }, { ease: S(0.25) });
      tl.to(inner, { scale: 1.06, duration: hold, ease: 'sine.out' }, A);
      tl.to(inner, { scale: 1.3, opacity: 0, filter: BL(10), duration: R, ease: 'power2.in' }, exitAt);
      break;

    case 'burst':
      size = base * 1.35;
      tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: A, ease: 'none' }, 0);
      tl.fromTo(inner, { scale: 0.2, rotation: -10 }, { scale: 1, rotation: 0, duration: 0.5, ease: S(0.55) }, 0);
      tl.to(inner, { scale: 1.45, opacity: 0, filter: BL(10), duration: R, ease: 'power2.in' }, exitAt);
      break;

    case 'fall': {
      pref = 'top';
      tl.fromTo(chars, { y: -base * 1.4, opacity: 0 }, { y: 0, opacity: 1, duration: Math.max(0.3, A * 1.4), stagger: A * 0.5 / chars.length, ease: 'bounce.out' }, 0);
      const f = word('fall');
      if (f) tl.to(f, { rotation: 8, y: base * 0.1, duration: hold, ease: 'power1.in' }, A);
      tl.to(chars, { y: () => innerHeight * rnd(0.18, 0.32), rotation: () => rnd(-55, 55), opacity: 0, duration: R + 0.35, stagger: 0.02, ease: 'power2.in' }, exitAt);
      break;
    }

    case 'stand':
      pref = 'bottom';
      words.forEach((w) => gsap.set(w, { transformOrigin: '50% 100%' }));
      inParts(tl, words, A, { scaleY: 0, y: 16 }, { ease: S(0.45) });
      tl.to(el, { y: `-=${base * 0.25}`, duration: hold, ease: 'power2.out' }, A);
      outParts(tl, words, exitAt, R, { y: `-=${base * 0.5}` });
      break;

    case 'scrape':
      inParts(tl, words, A, { x: -base * 0.7, skewX: 32 }, { ease: (t) => Math.min(1, t + Math.sin(t * 42) * 0.05 * (1 - t)) });
      outParts(tl, words, exitAt, R, { x: `+=${base * 0.4}`, skewX: -20 });
      break;

    case 'shake':
      inParts(tl, words, A, { y: 10 });
      jitter(tl, inner, A * 0.6, hold + A * 0.4, Math.max(1.6, base * 0.06), 1);
      outParts(tl, words, exitAt, R);
      break;

    case 'draw': {
      const pen = document.createElement('span');
      pen.className = 'ly-pen';
      inner.appendChild(pen);
      const wipe = Math.min(dur * 0.6, 2.4);
      tl.set(inner, { opacity: 1 }, 0);
      tl.fromTo(inner, { clipPath: 'inset(-30% 100% -30% -5%)' }, { clipPath: 'inset(-30% 0% -30% -5%)', duration: wipe, ease: 'power1.inOut' }, 0);
      tl.fromTo(pen, { left: '0%', opacity: 1 }, { left: '100%', duration: wipe, ease: 'power1.inOut' }, 0);
      tl.to(pen, { opacity: 0, duration: 0.3 }, wipe);
      ['new', 'plans'].forEach((k) => word(k)?.classList.add('ly-underline'));
      tl.fromTo(el.querySelectorAll('.ly-underline'), { '--u': 0 }, { '--u': 1, duration: 0.6, stagger: 0.12, ease: 'power3.out' }, wipe * 0.85);
      outParts(tl, [inner], exitAt, R);
      break;
    }

    case 'no': {
      const no = words.find((w) => w.dataset.w === 'no');
      no?.classList.add('ly-no');
      inParts(tl, words.filter((w) => w !== no), A, { y: 14, filter: BL(8) });
      if (no) {
        tl.fromTo(no, { scale: 2.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: S(0.4) }, A * 0.3);
        tl.to(no, { rotation: 8, duration: 0.11, yoyo: true, repeat: 5, ease: 'sine.inOut' }, A + 0.4);
      }
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'wear':
      words.forEach((w) => gsap.set(w, { transformPerspective: 600 }));
      inParts(tl, words, A, { rotationY: -100, x: -10 }, { ease: S(0.35) });
      outParts(tl, words, exitAt, R);
      break;

    case 'skin':
      size = base * 1.15;
      tl.fromTo(inner, { opacity: 0, filter: BL(18), letterSpacing: '0.3em' }, { opacity: 1, filter: BL(0), letterSpacing: '0.01em', duration: Math.max(A, Math.min(1.1, dur * 0.5)), ease: 'power3.out' }, 0);
      tl.to(inner, { scale: 1.04, duration: hold, ease: 'sine.inOut' }, A);
      tl.to(inner, { opacity: 0, filter: BL(16), duration: R, ease: 'power1.in' }, exitAt);
      break;

    case 'foolish':
      word('foolish')?.classList.add('ly-italic');
      inParts(tl, words, A, { y: -20, rotation: -8 }, { ease: S(0.5) });
      tl.to(inner, { rotation: 4, duration: 0.45, yoyo: true, repeat: Math.max(1, Math.floor(hold / 0.45)), ease: 'sine.inOut' }, A);
      outParts(tl, words, exitAt, R);
      break;

    case 'gone': {
      inParts(tl, words, A, { y: 14 });
      const g = word('gone');
      if (g) tl.to(g.querySelectorAll('.lc'), { y: -base * 0.8, opacity: 0, filter: BL(6), duration: Math.max(0.3, hold * 0.6), stagger: hold * 0.12, ease: 'power1.in' }, A + 0.2);
      outParts(tl, words.filter((w) => w !== g), exitAt, R);
      break;
    }

    case 'punch': {
      const p = word('punchline');
      inParts(tl, words.filter((w) => w !== p), A, { y: 12 });
      if (p) {
        p.classList.add('ly-strong');
        tl.fromTo(p, { scale: 2.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: S(0.3) }, A * 0.6);
        jitter(tl, inner, A * 0.6 + 0.12, 0.3, base * 0.08, 1.5);
      }
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'wrong':
      chars.forEach((c) => gsap.set(c, { y: rnd(-0.12, 0.12) * base, rotation: rnd(-9, 9) }));
      inParts(tl, words, A, { y: 16, rotation: 6 });
      tl.to(inner, { rotation: -4, duration: 0.7, yoyo: true, repeat: Math.max(1, Math.floor(hold / 0.7)), ease: 'sine.inOut' }, 0);
      outParts(tl, words, exitAt, R);
      break;

    case 'choose':
      inParts(tl, words, Math.min(dur * 0.7, A + 0.6), { y: 24, filter: BL(6) }, { ease: S(0.3) });
      outParts(tl, words, exitAt, R);
      break;

    case 'heart': {
      const h = word('heart');
      h?.classList.add('ly-heart');
      inParts(tl, words, A, { y: 16, filter: BL(8) });
      if (h) {
        const beats = Math.max(1, Math.floor(hold / 0.78));
        for (let k = 0; k < beats; k++) {
          const at = A + k * 0.78;
          tl.to(h, { scale: 1.2, duration: 0.09, ease: 'power2.out' }, at)
            .to(h, { scale: 1.02, duration: 0.12, ease: 'power2.in' }, at + 0.09)
            .to(h, { scale: 1.12, duration: 0.08, ease: 'power2.out' }, at + 0.22)
            .to(h, { scale: 1, duration: 0.25, ease: 'power2.inOut' }, at + 0.3);
        }
      }
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'losing': {
      inParts(tl, words, A, { y: 14 });
      const second = words.filter((w) => w.dataset.w === 'losing')[1];
      if (second) tl.to(second, { y: base * 0.35, opacity: 0.45, duration: hold, ease: 'sine.in' }, A);
      outParts(tl, words, exitAt, R);
      break;
    }

    case 'start': {
      inParts(tl, words, A, { y: 18, filter: BL(10) }, { ease: 'power3.out' });
      const st = word('start');
      if (st) {
        tl.to(st, { scaleY: 0.82, y: base * 0.06, transformOrigin: '50% 100%', duration: 0.5, ease: 'power2.in' }, Math.max(A, exitAt - 0.9));
        tl.to(st, { scaleY: 1.12, y: -base * 0.7, duration: 0.5, ease: S(0.4) }, Math.max(A + 0.5, exitAt - 0.4));
      }
      outParts(tl, words, exitAt, R, { y: `-=${base * 0.6}` });
      break;
    }

    case 'whisper':
      size = base * 0.82;
      tl.fromTo(inner, { opacity: 0, filter: BL(10) }, { opacity: 0.68, filter: BL(0), duration: Math.max(A, 0.6), ease: 'power2.out' }, 0);
      tl.to(inner, { opacity: 0, filter: BL(8), duration: R, ease: 'power1.in' }, exitAt);
      break;

    case 'enough':
      el.classList.add('ly--heavy');
      tl.fromTo(inner, { y: -base * 1.4, opacity: 0 }, { y: 0, opacity: 1, duration: Math.max(0.45, A * 1.8), ease: 'bounce.out' }, 0);
      tl.to(inner, { scaleY: 0.94, scaleX: 1.03, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' }, Math.max(0.45, A * 1.8) - 0.1);
      tl.to(inner, { y: base * 0.7, opacity: 0, filter: BL(8), duration: R, ease: 'power2.in' }, exitAt);
      break;

    case 'day':
      pref = 'bottom';
      el.classList.add('ly--warm');
      inParts(tl, words, A, { y: base * 0.9, filter: BL(10) }, { ease: 'power3.out' });
      outParts(tl, words, exitAt, R);
      break;

    case 'istart':
      pref = 'center';
      size = base * 1.5;
      tl.fromTo(inner, { opacity: 0 }, { opacity: 1, duration: A, ease: 'none' }, 0);
      tl.fromTo(inner, { scale: 0.5, y: base * 1.2 }, { scale: 1, y: 0, duration: 0.7, ease: S(0.5) }, 0);
      tl.to(inner, { y: -base * 0.8, opacity: 0, filter: BL(10), duration: R, ease: 'power2.in' }, exitAt);
      break;

    default: // gentle drift; long, sustained lines open up a little
      inParts(tl, words, A, { y: 20, filter: BL(10) }, { ease: 'power3.out' });
      tl.to(el, { y: `-=${base * 0.3}`, duration: m.total, ease: 'sine.out' }, 0);
      if (dur / m.t.length > 0.11) tl.fromTo(inner, { letterSpacing: '0em' }, { letterSpacing: '0.05em', duration: dur, ease: 'sine.out' }, 0);
      outParts(tl, words, exitAt, R);
  }
  tl.set(el, { autoAlpha: 0 }, m.total);
  el.style.fontSize = `${Math.round(size)}px`;
  return { el, tl, pref };
}

// ───────────── placement: find calm, empty space ─────────────
function overlap(a, b) {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function place(el, pref, occupied, lastPos) {
  const vw = innerWidth;
  const vh = innerHeight;
  const pad = vw < 720 ? 12 : 28;
  const nav = cinema ? null : document.querySelector('.nav__pill')?.getBoundingClientRect();
  const top = cinema ? Math.max(24, vh * 0.08) : (nav ? nav.bottom : 70) + 10;
  const reach = (+el.dataset.reach || 0) + el.offsetWidth * (+el.dataset.grow || 0);
  let w = el.offsetWidth + reach;
  let h = el.offsetHeight;
  const maxW = vw - pad * 2;
  if (w > maxW) {
    const f = maxW / w;
    el.style.fontSize = `${parseFloat(el.style.fontSize) * f}px`;
    w = (el.offsetWidth + reach) * f;
    h = el.offsetHeight;
  }
  const avoid = [...document.querySelectorAll(cinema ? AVOID_CINEMA : AVOID)]
    .map((n) => n.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw)
    .map((r) => ({ left: r.left - 12, right: r.right + 12, top: r.top - 10, bottom: r.bottom + 10 }));
  const area = w * h;
  let best = null;
  const COLS = 7;
  const ROWS = 7;
  for (let gx = 0; gx < COLS; gx++) {
    for (let gy = 0; gy < ROWS; gy++) {
      const x = pad + ((maxW - w) * gx) / (COLS - 1);
      const y = top + ((vh - top - pad - h) * gy) / (ROWS - 1);
      const box = { left: x, right: x + w, top: y, bottom: y + h };
      let s = 0;
      for (const r of avoid) s += (overlap(box, r) / area) * 6;
      for (const r of occupied) s += (overlap(box, r) / area) * 5;
      const cx = (x + w / 2) / vw;
      const cy = (y + h / 2) / vh;
      if (pref === 'center') s += Math.abs(cx - 0.5) * 4 + Math.abs(cy - 0.5) * 1.2;
      else if (pref === 'top') s += cy * 1.6;
      else if (pref === 'bottom') s += (1 - cy) * 1.6;
      else if (pref === 'left') s += cx * 1.8;
      else if (pref === 'corner') s += Math.min(Math.hypot(cx - 0.08, cy - 0.92), Math.hypot(cx - 0.92, cy - 0.92)) * 2;
      if (lastPos && pref !== 'center') s += Math.max(0, 0.25 - Math.hypot(cx - lastPos.x, cy - lastPos.y)) * 3;
      s += Math.random() * (pref === 'center' ? 0.15 : 0.7);
      if (!best || s < best.s) best = { s, x, y, cx, cy };
    }
  }
  el.style.left = `${best.x}px`;
  el.style.top = `${best.y}px`;
  return { x: best.cx, y: best.cy, rect: { left: best.x, top: best.y, right: best.x + w, bottom: best.y + h } };
}

if (import.meta.env.DEV) window.__lyricsDebug = { build: (i, base = 48) => build(META[i], base), META };

// ───────────── engine ─────────────
export function createLyrics(layer, { onCue } = {}) {
  let audio = null;
  let running = false;
  let lastT = -1;
  let aLast = 0;
  let pLast = 0;
  let lastPos = null;
  const active = new Map();
  const announced = new Set();

  const clock = () => {
    const a = audio.currentTime;
    const p = performance.now();
    if (a !== aLast) {
      aLast = a;
      pLast = p;
    }
    if (audio.paused) return a;
    return Math.min(aLast + (p - pLast) / 1000, a + 0.3);
  };

  const clear = () => {
    for (const { el, tl } of active.values()) {
      tl.kill();
      el.remove();
    }
    active.clear();
    announced.clear();
  };

  const base = () => Math.round(clamp(innerWidth * 0.034, 24, 58));

  const spawn = (m) => {
    const { el, tl, pref } = build(m, base());
    gsap.set(el, { autoAlpha: 0 });
    layer.appendChild(el);
    const occupied = [...active.values()].map((a) => a.rect);
    const pos = place(el, pref, occupied, lastPos);
    if (pref !== 'center') lastPos = pos;
    active.set(m.i, { el, tl, rect: pos.rect, fx: 0, fs: 1, words: [...el.querySelectorAll('.ly__in .lw')] });
  };

  let lastDuck = 0;
  const duck = (now) => {
    if (now - lastDuck < 140 || !active.size) return;
    lastDuck = now;
    const vh = innerHeight;
    const rects = [...document.querySelectorAll(cinema ? AVOID_CINEMA : AVOID)]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.width && r.bottom > 0 && r.top < vh);
    for (const a of active.values()) {
      const r = a.el.getBoundingClientRect();
      const area = Math.max(1, r.width * r.height);
      let f = 0;
      for (const c of rects) f += overlap(r, c) / area;
      const o = f > 0.3 ? 0.14 : f > 0.1 ? 0.45 : 1;
      if (a.duck !== o) {
        a.duck = o;
        a.el.firstElementChild.style.opacity = o;
      }
    }
  };

  // keep every visible letter inside the left/right screen edges
  const contain = () => {
    const vw = innerWidth;
    const pad = edgePad();
    for (const a of active.values()) {
      let L = Infinity;
      let R = -Infinity;
      for (const w of a.words) {
        if (gsap.getProperty(w, 'opacity') < 0.05) continue;
        for (const c of w.children) {
          const r = c.getBoundingClientRect();
          if (!r.width) continue;
          if (r.left < L) L = r.left;
          if (r.right > R) R = r.right;
        }
      }
      if (L === Infinity) continue;
      const duck = a.el.firstElementChild;
      const d = duck.getBoundingClientRect();
      const c = d.left + d.width / 2; // the duck scales around its centre
      const avail = vw - pad * 2;
      const width = R - L;
      let k = 1;
      if (width > avail) k = (avail / width) * 0.995; // too wide (e.g. an entrance punch): fit it
      else if (a.fs < 1) k = Math.min(1 / a.fs, (avail / width) * 0.995, 1.06); // ease back to full size
      const nl = c + (L - c) * k;
      const nr = c + (R - c) * k;
      const shift = nl < pad ? pad - nl : nr > vw - pad ? vw - pad - nr : 0;
      if (k !== 1 || Math.abs(shift) > 0.3) {
        a.fs *= k;
        a.fx += shift;
        duck.style.transform = `translate3d(${a.fx.toFixed(1)}px,0,0) scale(${a.fs.toFixed(4)})`;
      }
    }
  };

  const frame = () => {
    if (!running) return;
    requestAnimationFrame(frame);
    duck(performance.now());
    const t = clock() - AUDIO_OFFSET;
    if (t < lastT - 0.75) clear(); // song looped or was seeked back
    lastT = t;
    for (const m of META) {
      if (!announced.has(m.i) && t >= m.s - 1.9 && t < m.s) {
        announced.add(m.i);
        onCue?.(m, (m.s - t) * 1000);
      }
      const inside = t >= m.s && t < m.s + m.total;
      const a = active.get(m.i);
      if (inside && !a) spawn(m);
      if (active.has(m.i)) {
        const cur = active.get(m.i);
        if (!inside) {
          cur.tl.kill();
          cur.el.remove();
          active.delete(m.i);
        } else cur.tl.time(t - m.s);
      }
    }
    contain();
  };

  return {
    attach(el) {
      audio = el;
    },
    play() {
      if (running || !audio) return;
      running = true;
      layer.classList.add('is-on');
      requestAnimationFrame(frame);
    },
    pause() {
      running = false;
      layer.classList.remove('is-on');
    },
    reset: clear,
    /** lift the lyrics above the intro film (true) or back behind the page */
    setCinema(on) {
      cinema = on;
      layer.classList.toggle('is-cinema', on);
    },
  };
}
