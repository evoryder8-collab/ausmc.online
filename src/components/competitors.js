// The competitors: a full page of its own that grows out of the button in the
// schedule. Round by round or A–Z, searchable by name, number or country,
// filterable by category and nation; every round has its reminder bell.
import { gsap } from 'gsap';
import { spring } from '../lib/spring.js';
import { sound } from '../lib/audio.js';
import { icon } from '../lib/icons.js';
import { at, timeText, tzState, localZoneLabel, eventEnd } from '../lib/time.js';
import { flagUrl } from '../lib/worldflags.js';
import { CATEGORIES, COUNTRIES, ROUNDS, COMPETITORS, NATIONS } from '../data/participants.js';
import { personWords, matches, tokens } from '../lib/people-search.js';
import '../styles/competitors.css';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pad = (n) => String(n).padStart(3, '0');
const DAY = { 'day-2': ['Saturday', '10 October', 'Sat'], 'day-3': ['Sunday', '11 October', 'Sun'] };
const COLORS = { freestyle: '#ff5c7c', remedial: '#7aa2ff', wellness: '#4fd8c6', facial: '#ff9fc6', sports: '#ffb54d', thai: '#e8c46a', student: '#b99dff' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const flags = (codes) => `<span class="cp-flags">${codes.map((c) => `<img src="${flagUrl(c)}" alt="${COUNTRIES[c]}" title="${COUNTRIES[c]}" width="24" height="18" decoding="async">`).join('')}</span>`;
const saved = () => { try { return JSON.parse(localStorage.getItem('ausmc:reminders') || '[]'); } catch { return []; } };
const bell = (key, label, set) =>
  `<button type="button" class="remind${set ? ' is-set' : ''}" data-remind="${key}" aria-label="Add a calendar reminder: ${esc(label)}" title="Add to calendar">${icon('bell')}<span class="remind__done" aria-hidden="true">${icon('bellring')}</span></button>`;
const tzLabel = () => (tzState.mode === 'sydney' ? 'AEDT' : localZoneLabel());
const roundTime = (r) => `${timeText(at(r.date, r.start))} – ${timeText(at(r.date, r.end))}`;
const roundCount = (r) => r.groups.reduce((n, [, l]) => n + l.length, 0);
const byNum = new Map(COMPETITORS.map((p) => [p.num, p]));
// searchable words: a row knows only its own category; a person (A–Z) all of theirs
const wordCache = new Map();
const wordsFor = (p, cat) => {
  const k = `${p.num}:${cat || '*'}`;
  if (!wordCache.has(k)) wordCache.set(k, personWords(p, cat ? [cat] : p.apps.map((a) => a.cat), CATEGORIES));
  return wordCache.get(k);
};

let root = null;
let ui = null;
let opener = null;
let pushed = false;
let lenisRef = null;

function build() {
  const remind = saved();
  root = document.createElement('div');
  root.className = 'cp';
  root.id = 'competitors';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'cp-title');

  const roundsHtml = ['day-2', 'day-3'].map((day) => `
    <section class="cp-day" data-day="${day}">
      <h3 class="cp-day__head"><span>${DAY[day][0]}</span> ${DAY[day][1]}</h3>
      ${ROUNDS.filter((r) => r.day === day).map((r) => `
        <article class="cp-round" data-round="${r.id}">
          <header class="cp-round__head">
            <div class="cp-round__when">
              <span class="cp-round__n">Round ${r.n}</span>
              <span class="cp-round__time"><span data-time="${r.id}">${roundTime(r)}</span> <i data-tz>${tzLabel()}</i></span>
            </div>
            <span class="cp-round__live" hidden></span>
            <span class="cp-round__count">${roundCount(r)} competing</span>
            ${bell(r.remind, `Competition Round ${r.n}, ${DAY[day][0]}`, remind.includes(r.remind))}
          </header>
          ${r.groups.map(([cat, list]) => `
            <div class="cp-group" data-cat="${cat}" style="--c:${COLORS[cat]}">
              <h4 class="cp-group__name"><span class="cp-dot"></span>${CATEGORIES[cat]}<span class="cp-group__n">${list.length}</span></h4>
              <ul class="cp-rows">
                ${list.map(([num, name, fl, note]) => {
                  const p = byNum.get(num);
                  const others = p.apps.filter((a) => !(a.round === r && a.cat === cat));
                  return `<li class="cp-row" data-num="${num}" data-cat="${cat}">
                    <button type="button" class="cp-row__btn" aria-expanded="false"${others.length ? '' : ' disabled'}>
                      <span class="cp-num">${pad(num)}</span>
                      <span class="cp-name">${esc(name)}${note ? `<small>${esc(note)}</small>` : ''}</span>
                      ${others.length ? `<span class="cp-more" title="Also competing">+${others.length}</span>` : ''}
                      ${flags(p.flags.length >= fl.length ? p.flags : fl)}
                    </button>
                    ${others.length ? `<div class="cp-row__more" hidden><span class="cp-row__also">Also competing</span>${others.map(appChip).join('')}</div>` : ''}
                  </li>`;
                }).join('')}
              </ul>
            </div>`).join('')}
        </article>`).join('')}
    </section>`).join('');

  const peopleHtml = `<ul class="cp-people">${COMPETITORS.map((p) => `
    <li class="cp-person" data-num="${p.num}">
      <span class="cp-num">${pad(p.num)}</span>
      <div class="cp-person__main">
        <span class="cp-name">${esc(p.name)}</span>
        <span class="cp-apps">${p.apps.map(appChip).join('')}</span>
      </div>
      ${flags(p.flags)}
    </li>`).join('')}</ul>`;

  root.innerHTML = `
    <div class="cp__scrim"></div>
    <div class="cp__sheet" data-lenis-prevent>
      <header class="cp__bar">
        <button type="button" class="cp__back glass">${icon('back')}<span>Schedule</span></button>
        <span class="cp__bar-title" aria-hidden="true">Competitors</span>
        <span class="cp__bar-count" aria-hidden="true"></span>
      </header>
      <div class="cp__hero">
        <h2 class="cp__title" id="cp-title">The <em>Competitors</em></h2>
        <p class="cp__sub"><b>${COMPETITORS.length}</b> therapists <span>·</span> <b>${NATIONS.length}</b> nations <span>·</span> <b>${Object.keys(CATEGORIES).length}</b> categories <span>·</span> <b>${ROUNDS.length}</b> rounds</p>
        <div class="cp__nations" role="group" aria-label="Filter by nation">
          ${NATIONS.map(({ code, n }) => `<button type="button" class="cp-nation" data-nation="${code}" aria-pressed="false"><img src="${flagUrl(code)}" alt="" width="22" height="16" decoding="async"><span>${COUNTRIES[code]}</span><b>${n}</b></button>`).join('')}
        </div>
      </div>
      <div class="cp__controls"><div class="cp__controls-in">
        <label class="cp__search glass">
          <canvas class="cp__rim" aria-hidden="true"></canvas>
          ${icon('search')}
          <input type="search" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Search name, number or country" aria-label="Search competitors">
          <button type="button" class="cp__clear" aria-label="Clear search" hidden>×</button>
        </label>
        <div class="cp__row2">
          <div class="cp__cats" role="group" aria-label="Filter by category">
            <button type="button" class="cp-cat is-on" data-cat="" aria-pressed="true">All</button>
            ${Object.entries(CATEGORIES).map(([k, v]) => `<button type="button" class="cp-cat" data-cat="${k}" style="--c:${COLORS[k]}" aria-pressed="false"><span class="cp-dot"></span>${v}</button>`).join('')}
          </div>
          <div class="cp__view glass" role="tablist" aria-label="View">
            <button type="button" role="tab" data-view="rounds" aria-selected="true">Rounds</button>
            <button type="button" role="tab" data-view="people" aria-selected="false">A–Z</button>
          </div>
        </div>
      </div></div>
      <div class="cp__list" data-view="rounds">
        <div class="cp__rounds">${roundsHtml}</div>
        <div class="cp__az" hidden>${peopleHtml}</div>
        <div class="cp__empty" hidden><p></p><button type="button" class="cp__reset">Show everyone</button></div>
      </div>
      <p class="cp__foot">Competitor numbers, categories and rounds as published by the Australian Massage Championship. Times in <span data-tz>${tzLabel()}</span>.</p>
    </div>`;
  document.body.appendChild(root);

  ui = {
    sheet: root.querySelector('.cp__sheet'),
    scrim: root.querySelector('.cp__scrim'),
    bar: root.querySelector('.cp__bar'),
    input: root.querySelector('.cp__search input'),
    clear: root.querySelector('.cp__clear'),
    rounds: root.querySelector('.cp__rounds'),
    az: root.querySelector('.cp__az'),
    empty: root.querySelector('.cp__empty'),
    count: root.querySelector('.cp__bar-count'),
    state: { q: '', cat: '', nation: '', view: 'rounds' },
  };
  wire();
}

function appChip(a) {
  const r = a.round;
  return `<span class="cp-app" style="--c:${COLORS[a.cat]}"><span class="cp-dot"></span><b>${CATEGORIES[a.cat]}</b> ${DAY[r.day][2]} · R${r.n} · <span data-start="${r.id}">${timeText(at(r.date, r.start))}</span></span>`;
}

// ───────────── filtering ─────────────
function apply({ animate = true } = {}) {
  const { q, cat, nation, view } = ui.state;
  const toks = tokens(q);
  const fq = toks.length > 0;
  const match = (p, c) => (!cat || c === cat) && (!nation || p.flags.includes(nation)) && (!fq || matches(wordsFor(p, c), toks));
  let shown = 0;
  const people = new Set();
  if (view === 'rounds') {
    ui.rounds.querySelectorAll('.cp-round').forEach((round) => {
      let inRound = 0;
      round.querySelectorAll('.cp-group').forEach((g) => {
        let inGroup = 0;
        g.querySelectorAll('.cp-row').forEach((row) => {
          const p = byNum.get(+row.dataset.num);
          const ok = match(p, row.dataset.cat);
          row.hidden = !ok;
          if (ok) {
            inGroup++;
            people.add(p.num);
          }
        });
        g.hidden = !inGroup;
        inRound += inGroup;
      });
      round.hidden = !inRound;
      shown += inRound;
    });
    ui.rounds.querySelectorAll('.cp-day').forEach((d) => (d.hidden = ![...d.querySelectorAll('.cp-round')].some((r) => !r.hidden)));
  } else {
    ui.az.querySelectorAll('.cp-person').forEach((li) => {
      const p = byNum.get(+li.dataset.num);
      const ok = (!cat || p.apps.some((a) => a.cat === cat)) && (!nation || p.flags.includes(nation)) && (!fq || matches(wordsFor(p), toks));
      li.hidden = !ok;
      if (ok) {
        shown++;
        people.add(p.num);
      }
    });
  }
  const filtered = fq || cat || nation;
  ui.count.textContent = filtered ? `${people.size} of ${COMPETITORS.length}` : `${COMPETITORS.length}`;
  ui.empty.hidden = shown > 0;
  if (!shown) {
    const what = [q.trim() && `“${q.trim()}”`, cat && CATEGORIES[cat], nation && COUNTRIES[nation]].filter(Boolean).join(' · ');
    ui.empty.querySelector('p').textContent = `No competitor matches ${what}.`;
  }
  if (animate && !reduced) {
    const list = ui.state.view === 'rounds' ? ui.rounds : ui.az;
    const rows = [...list.querySelectorAll('.cp-row:not([hidden]), .cp-person:not([hidden])')].slice(0, 14);
    gsap.fromTo(rows, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.018, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' });
  }
}

function setPressed(sel, attr, value) {
  root.querySelectorAll(sel).forEach((b) => {
    const on = b.dataset[attr] === value;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
}

function refreshTimes() {
  root.querySelectorAll('[data-time]').forEach((el) => (el.textContent = roundTime(ROUNDS.find((r) => r.id === el.dataset.time))));
  root.querySelectorAll('[data-start]').forEach((el) => {
    const r = ROUNDS.find((x) => x.id === el.dataset.start);
    el.textContent = timeText(at(r.date, r.start));
  });
  root.querySelectorAll('[data-tz]').forEach((el) => (el.textContent = tzLabel()));
}

/** LIVE / up next on the round cards while the championship is on */
function refreshLive() {
  const now = Date.now();
  if (now > eventEnd.getTime()) return;
  const next = ROUNDS.find((r) => at(r.date, r.start).getTime() > now);
  root.querySelectorAll('.cp-round').forEach((el) => {
    const r = ROUNDS.find((x) => x.id === el.dataset.round);
    const live = now >= at(r.date, r.start).getTime() && now < at(r.date, r.end).getTime();
    const badge = el.querySelector('.cp-round__live');
    const soon = !live && next === r && at(r.date, r.start).getTime() - now < 3 * 3600e3;
    badge.hidden = !live && !soon;
    badge.className = `cp-round__live${live ? ' is-live' : ''}`;
    badge.innerHTML = live ? '<span class="live-dot"></span>Live' : soon ? 'Up next' : '';
  });
}

function wire() {
  const { input, clear } = ui;
  root.querySelector('.cp__back').addEventListener('click', () => close());
  ui.scrim.addEventListener('click', () => close());
  root.addEventListener('keydown', (e) => e.key === 'Escape' && close());

  let typing;
  // the keyboard's Search key puts the keyboard away so the results show
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
  });
  input.addEventListener('input', () => {
    ui.state.q = input.value;
    clear.hidden = !input.value;
    clearTimeout(typing);
    typing = setTimeout(() => apply(), 90);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    ui.state.q = '';
    clear.hidden = true;
    apply();
    input.focus();
  });
  root.querySelector('.cp__cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    sound.tap();
    ui.state.cat = ui.state.cat === b.dataset.cat ? '' : b.dataset.cat;
    setPressed('.cp-cat', 'cat', ui.state.cat);
    apply();
  });
  root.querySelector('.cp__nations').addEventListener('click', (e) => {
    const b = e.target.closest('[data-nation]');
    if (!b) return;
    sound.tap();
    ui.state.nation = ui.state.nation === b.dataset.nation ? '' : b.dataset.nation;
    setPressed('.cp-nation', 'nation', ui.state.nation);
    apply();
  });
  root.querySelector('.cp__view').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === ui.state.view) return;
    sound.tap();
    ui.state.view = b.dataset.view;
    root.querySelectorAll('[data-view][role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
    root.querySelector('.cp__list').dataset.view = ui.state.view;
    ui.rounds.hidden = ui.state.view !== 'rounds';
    ui.az.hidden = ui.state.view !== 'people';
    apply();
  });
  ui.empty.querySelector('.cp__reset').addEventListener('click', () => {
    ui.state = { ...ui.state, q: '', cat: '', nation: '' };
    input.value = '';
    clear.hidden = true;
    setPressed('.cp-cat', 'cat', '');
    setPressed('.cp-nation', 'nation', '');
    apply();
  });
  // a competitor's other rounds fold open beneath their row
  ui.rounds.addEventListener('click', (e) => {
    const b = e.target.closest('.cp-row__btn');
    if (!b || b.disabled) return;
    const more = b.nextElementSibling;
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    sound.softPop({ pitch: open ? 1.15 : 0.95, gain: 0.04 });
    if (open) {
      more.hidden = false;
      if (!reduced) gsap.fromTo(more, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.45, ease: spring({ bounce: 0.2 }), clearProps: 'height' });
    } else if (reduced) {
      more.hidden = true;
    } else {
      gsap.to(more, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.in', onComplete: () => { more.hidden = true; gsap.set(more, { clearProps: 'all' }); } });
    }
  });
  // the bar's title appears once the big one has scrolled away
  const title = root.querySelector('.cp__title');
  ui.sheet.addEventListener('scroll', () => {
    root.classList.toggle('is-scrolled', title.getBoundingClientRect().bottom < ui.bar.getBoundingClientRect().bottom);
  }, { passive: true });
  document.addEventListener('ausmc:tz', refreshTimes);
  addEventListener('popstate', () => {
    if (isOpen() && !location.hash.includes('competitors')) close({ fromHistory: true });
  });
}

const isOpen = () => root && !root.hidden && !root.classList.contains('is-closing');
let liveTimer = null;

/** opens the page, growing it out of `from` (the button in the schedule) */
// ───────────── the gleam that circles the search bar ─────────────
// Drawn each frame along the bar's rounded edge in short segments whose
// width and brightness follow one smooth curve: a fine streak of light,
// thickest in the middle and fading to nothing at both ends.
let gleamOn = false;
function runGleam() {
  if (reduced || gleamOn) return;
  const canvas = root.querySelector('.cp__rim');
  const bar = root.querySelector('.cp__search');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  gleamOn = true;
  const PAD = 4; // the canvas reaches a little past the edge so the stroke isn't clipped
  const R = 18; // the bar's corner radius
  const LAP = 6.5; // seconds per lap
  let w = 0;
  let h = 0;
  let r = R;
  let P = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    w = bar.offsetWidth - 1; // the centre line of the 1px border
    h = bar.offsetHeight - 1;
    r = Math.min(R - 0.5, h / 2, w / 2);
    P = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
    canvas.width = Math.round((bar.offsetWidth + PAD * 2) * dpr); // exactly its CSS size: no stretch
    canvas.height = Math.round((bar.offsetHeight + PAD * 2) * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, (PAD + 0.5) * dpr, (PAD + 0.5) * dpr);
  };
  /** a point on the rounded edge, `s` px clockwise from the top-left corner's end */
  const at = (s) => {
    s = ((s % P) + P) % P;
    const tw = w - 2 * r;
    const sh = h - 2 * r;
    const q = (Math.PI * r) / 2;
    const arc = (cx, cy, a0, d) => [cx + r * Math.cos(a0 + d / r), cy + r * Math.sin(a0 + d / r)];
    if (s < tw) return [r + s, 0];
    s -= tw;
    if (s < q) return arc(w - r, r, -Math.PI / 2, s);
    s -= q;
    if (s < sh) return [w, r + s];
    s -= sh;
    if (s < q) return arc(w - r, h - r, 0, s);
    s -= q;
    if (s < tw) return [w - r - s, h];
    s -= tw;
    if (s < q) return arc(r, h - r, Math.PI / 2, s);
    s -= q;
    if (s < sh) return [0, h - r - s];
    s -= sh;
    return arc(r, r, Math.PI, s);
  };
  const ro = new ResizeObserver(size);
  ro.observe(bar);
  size();
  const N = 40;
  const t0 = performance.now();
  /** one continuous line along the edge from s0 to s1, faded along its length */
  const streak = (s0, s1, width, peak) => {
    const [ax, ay] = at(s0);
    const [bx, by] = at(s1);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      g.addColorStop(u, `rgba(240,246,255,${(peak * Math.pow(Math.sin(Math.PI * u), 1.6)).toFixed(3)})`);
    }
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    for (let i = 1; i <= N; i++) {
      const [x, y] = at(s0 + ((s1 - s0) * i) / N);
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = g;
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const frame = (now) => {
    if (root.hidden || root.classList.contains('is-closing')) {
      gleamOn = false;
      ro.disconnect();
      return;
    }
    requestAnimationFrame(frame);
    ctx.clearRect(-PAD - 1, -PAD - 1, w + PAD * 2 + 2, h + PAD * 2 + 2);
    const len = Math.min(95, P * 0.12);
    const mid = (((now - t0) / 1000) / LAP) * P;
    // a hair-thin streak, with a slightly fuller, brighter core in its middle
    streak(mid - len / 2, mid + len / 2, 0.5, 0.75);
    streak(mid - len * 0.28, mid + len * 0.28, 1, 0.85);
  };
  requestAnimationFrame(frame);
}

export function openCompetitors({ from, lenis, history: push = true } = {}) {
  if (!root) build();
  if (isOpen()) return;
  opener = from || null;
  lenisRef = lenis || null;
  refreshTimes();
  refreshLive();
  clearInterval(liveTimer);
  liveTimer = setInterval(refreshLive, 30e3);
  apply({ animate: false });
  root.hidden = false;
  root.classList.remove('is-closing');
  requestAnimationFrame(runGleam);
  document.documentElement.classList.add('cp-open');
  lenisRef?.stop();
  ui.sheet.scrollTop = 0;
  if (push && !location.hash.includes('competitors')) {
    history.pushState({ cp: 1 }, '', '#competitors');
    pushed = true;
  }
  sound.whoosh({ dur: 0.6, f0: 300, f1: 1600, gain: 0.05, pan0: 0, pan1: 0, wet: 0.35 });
  const r = opener?.getBoundingClientRect();
  if (reduced || !r?.width) {
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  } else {
    // the button becomes the page: its pill shape grows to fill the screen
    const inset = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${r.height / 2}px)`;
    gsap.fromTo(ui.sheet, { clipPath: inset }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.85, ease: spring({ bounce: 0.14 }), clearProps: 'clipPath' });
    gsap.fromTo(ui.scrim, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    const hero = root.querySelectorAll('.cp__back, .cp__bar-count, .cp__hero > *, .cp__controls');
    gsap.fromTo(hero, { opacity: 0, y: 26, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.05, delay: 0.18, ease: 'expo.out', clearProps: 'filter,transform' });
    const rows = [...ui.rounds.querySelectorAll('.cp-day__head, .cp-round__head, .cp-group__name, .cp-row')].slice(0, 16);
    gsap.fromTo(rows, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.03, delay: 0.42, ease: spring({ bounce: 0.25 }), clearProps: 'transform' });
  }
  requestAnimationFrame(() => root.querySelector('.cp__back').focus({ preventScroll: true }));
}

export function closeCompetitors() {
  close();
}

function close({ fromHistory = false } = {}) {
  if (!isOpen()) return;
  // the browser's back button closes the page; our own back steps history too
  if (!fromHistory && pushed) {
    pushed = false;
    history.back();
    return;
  }
  pushed = false;
  if (!fromHistory && location.hash.includes('competitors')) history.replaceState(null, '', location.pathname + location.search);
  root.classList.add('is-closing');
  clearInterval(liveTimer);
  sound.whoosh({ dur: 0.45, f0: 1500, f1: 320, gain: 0.04, pan0: 0, pan1: 0, wet: 0.3 });
  const done = () => {
    root.hidden = true;
    root.classList.remove('is-closing');
    document.documentElement.classList.remove('cp-open');
    lenisRef?.start();
    opener?.focus({ preventScroll: true });
  };
  const r = opener?.getBoundingClientRect();
  const visible = r && r.width && r.bottom > 0 && r.top < innerHeight;
  if (reduced || !visible) {
    gsap.to(root, { opacity: 0, duration: 0.3, onComplete: () => { gsap.set(root, { clearProps: 'opacity' }); done(); } });
    return;
  }
  const inset = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round ${r.height / 2}px)`;
  gsap.to(ui.scrim, { opacity: 0, duration: 0.45 });
  gsap.fromTo(ui.sheet, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: inset, duration: 0.55, ease: 'power3.inOut', onComplete: () => { gsap.set(ui.sheet, { clearProps: 'clipPath' }); done(); } });
}
