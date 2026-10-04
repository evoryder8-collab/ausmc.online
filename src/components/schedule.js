import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DAYS, EVENT } from '../data/schedule.js';
import { at, timeParts, dayShiftLabel, tzState, localDiffers, localZoneLabel, liveState, setTzMode, SYD } from '../lib/time.js';
import { calendarEntries, googleUrl, outlookUrl, FULL_ICS } from '../lib/calendar.js';
import { icon } from '../lib/icons.js';
import { flag } from '../lib/flags.js';
import { spring } from '../lib/spring.js';
import { sound } from '../lib/audio.js';

gsap.registerPlugin(ScrollTrigger);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** <time> that re-renders when the time-zone mode changes */
const t = (date, hm) => {
  const d = at(date, hm);
  const { hm: h, ap } = timeParts(d);
  return `<time class="tm" datetime="${d.toISOString()}" data-ts="${d.getTime()}"><span class="tm__hm">${h}</span><span class="tm__ap">${ap}</span></time>`;
};
const remind = (key, title) =>
  `<button type="button" class="remind" data-remind="${key}" aria-label="Add a calendar reminder: ${esc(title)}" title="Add to calendar">${icon('bell')}<span class="remind__done" aria-hidden="true">${icon('bellring')}</span></button>`;
const range = (date, a, b) => `${t(date, a)}<span class="tm__sep">–</span>${t(date, b)}`;
const shiftTag = (date, hm) => `<span class="tm__shift" data-shift="${at(date, hm).getTime()}"></span>`;

function renderMasterclass(day, block, bi) {
  const key = `${day.id}-b${bi}`;
  return `
  <article class="block block--masterclass glass" data-key="${key}">
    <header class="block__head">
      <div class="block__title"><span class="block__icon">${icon('demo')}</span><h3>${esc(block.title)}</h3></div>
      <div class="block__time pill">${icon('clock')}${range(day.date, block.start, block.end)}${shiftTag(day.date, block.start)}</div>
      <span class="status" aria-live="polite"></span>
    </header>
    <div class="cols-head" aria-hidden="true"><span>Presenter</span><span>Masterclass</span><span></span></div>
    <ol class="rows">
      ${block.sessions.map((s, pi) => `
      <li class="row row--presenter">
        <div class="presenter">
          <div class="presenter__line"><span class="presenter__name">${esc(s.presenter)}</span>${flag(s.country)}</div>
          <div class="presenter__role">${esc(s.role)}</div>
        </div>
        <div class="row__glyph" aria-hidden="true"></div>
        <div class="class-title">${esc(s.title)}</div>
        <div class="row__act">${remind(`${key}-p${pi}`, s.title)}</div>
      </li>`).join('')}
    </ol>
  </article>`;
}

function renderOnline(day, block, bi) {
  return `
  <article class="block block--online glass" data-key="${day.id}-b${bi}">
    <header class="block__head">
      <div class="block__title"><span class="block__icon block__icon--red">${icon('live')}</span><h3>${esc(block.title)}</h3></div>
      <div class="block__time pill pill--red"><span class="live-dot"></span>${esc(block.tag)}<i class="pill__div"></i>${range(day.date, block.start, block.end)}</div>
    </header>
    <ol class="rows rows--compact">
      ${block.sessions.map((s, si) => `
      <li class="row row--compact" data-key="${day.id}-b${bi}-s${si}">
        <span class="row__name">${esc(s.title)}</span>
        <span class="row__times">${range(day.date, s.start, s.end)}${shiftTag(day.date, s.start)}</span>
        <span class="status"></span>
        <span class="row__act">${remind(`${day.id}-b${bi}-s${si}`, `${block.title} ${s.title}`)}</span>
      </li>`).join('')}
    </ol>
  </article>`;
}

function renderProgram(day, block, bi) {
  return `
  <article class="block block--program glass" data-key="${day.id}-b${bi}">
    <header class="block__head">
      <div class="block__title"><span class="block__icon">${icon('awards')}</span><h3>${esc(block.title)}</h3></div>
      <div class="block__time pill">${icon('calendar')}${esc(day.weekday)}, ${esc(day.longDate)}</div>
    </header>
    <ol class="timeline">
      <span class="timeline__rail" aria-hidden="true"><span class="timeline__fill"></span></span>
      ${block.sessions.map((s, si) => {
        const showEnd = s.end && !s.openEnded;
        const kind = s.kind || 'session';
        return `
      <li class="row row--session kind-${kind}" data-key="${day.id}-b${bi}-s${si}">
        <div class="row__time">
          ${t(day.date, s.start)}
          ${showEnd ? `<span class="row__end"><span class="tm__sep">–</span>${t(day.date, s.end)}</span>` : ''}
          ${shiftTag(day.date, s.start)}
        </div>
        <div class="row__dot" aria-hidden="true"><span></span></div>
        <div class="row__body">
          <h4 class="row__title">${esc(s.title)}${s.meta ? ` <span class="row__meta">${esc(s.meta)}</span>` : ''}<span class="status"></span></h4>
          ${s.desc ? `<p class="row__desc">${esc(s.desc)}</p>` : ''}
          ${s.address ? `<p class="row__addr">${icon('pin')}<span>${esc(s.address)}</span> <button type="button" class="link-btn" data-goto-location="${s.location}">Show on map ${icon('external')}</button></p>` : ''}
        </div>
        <div class="row__act">${remind(`${day.id}-b${bi}-s${si}`, s.title)}</div>
      </li>`;
      }).join('')}
    </ol>
  </article>`;
}

function renderDay(day) {
  const blocks = day.blocks.map((b, bi) => {
    if (b.type === 'masterclass') return renderMasterclass(day, b, bi);
    if (b.type === 'online') return renderOnline(day, b, bi);
    if (b.type === 'program') return renderProgram(day, b, bi);
    return '';
  });
  return `
  <section class="day" id="${day.id}" data-day="${day.n - 1}" aria-labelledby="${day.id}-title">
    <header class="day__head">
      <div class="day__num" aria-hidden="true">0${day.n}</div>
      <div class="day__meta">
        <p class="day__label">Day ${day.n}</p>
        <h3 class="day__title" id="${day.id}-title"><span class="day__weekday">${esc(day.weekday)},</span> <span class="day__date">${esc(day.longDate)}</span></h3>
        <ul class="day__tags">${day.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </header>
    ${blocks.join('')}
  </section>`;
}

// ───────────────────────── behaviour ─────────────────────────

export function initSchedule({ lenis, reduced, glass }) {
  const daysEl = document.querySelector('.days');
  daysEl.innerHTML = DAYS.map(renderDay).join('');
  glass?.track(daysEl);

  // day switcher
  const nav = document.querySelector('.daynav');
  const indicator = nav.querySelector('.daynav__indicator');
  nav.insertAdjacentHTML('beforeend', DAYS.map((d, i) => `
    <button type="button" role="tab" class="daynav__btn" data-i="${i}" aria-controls="${d.id}" aria-selected="${i === 0}">
      <span class="daynav__day">Day ${d.n}</span><span class="daynav__date">${d.short}</span>
    </button>`).join(''));
  const btns = [...nav.querySelectorAll('.daynav__btn')];
  let active = -1;
  const place = (i, animate = true) => {
    const b = btns[i];
    if (!b) return;
    const x = b.offsetLeft;
    const w = b.offsetWidth;
    if (!animate || reduced) {
      gsap.set(indicator, { x, width: w });
      return;
    }
    const cur = gsap.getProperty(indicator, 'x');
    const cw = gsap.getProperty(indicator, 'width');
    const left = Math.min(cur, x);
    const right = Math.max(cur + cw, x + w);
    gsap.timeline()
      .to(indicator, { x: left, width: right - left, duration: 0.16, ease: 'power2.in' })
      .to(indicator, { x, width: w, duration: 0.7, ease: spring({ bounce: 0.38 }) });
  };
  const setActive = (i, animate = true) => {
    if (i === active) return;
    active = i;
    btns.forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
    place(i, animate);
  };
  requestAnimationFrame(() => setActive(0, false));
  addEventListener('resize', () => place(active, false));
  btns.forEach((b, i) => {
    b.addEventListener('click', () => {
      sound.tap();
      setActive(i);
      const target = document.getElementById(DAYS[i].id);
      lenis ? lenis.scrollTo(target, { offset: -150, duration: 1.4 }) : target.scrollIntoView({ behavior: 'smooth' });
    });
    b.addEventListener('pointerenter', () => sound.hover());
  });
  document.querySelectorAll('.day').forEach((sec, i) => {
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setActive(i) });
  });

  // time-zone toggle
  const tz = document.querySelector('.tz');
  const note = document.querySelector('.schedule__note');
  const writeNote = () => {
    note.innerHTML = tzState.mode === 'sydney'
      ? `${icon('clock')} All times are Sydney time (${EVENT.tzLabel}).`
      : `${icon('clock')} Times shown in your local time (${localZoneLabel()}). Switch back to Sydney time any time.`;
  };
  writeNote();
  if (localDiffers) {
    tz.hidden = false;
    tz.querySelector('[data-tz="local"]').textContent = `My time · ${localZoneLabel()}`;
    tz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tz]');
      if (!b || b.dataset.tz === tzState.mode) return;
      sound.tap();
      setTzMode(b.dataset.tz);
    });
  }
  document.addEventListener('ausmc:tz', () => {
    tz.querySelectorAll('[data-tz]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tz === tzState.mode)));
    refreshTimes(true);
    writeNote();
  });

  function refreshTimes(animate) {
    const els = document.querySelectorAll('.tm[data-ts]');
    els.forEach((el) => {
      const { hm, ap } = timeParts(new Date(+el.dataset.ts));
      const apply = () => {
        el.querySelector('.tm__hm').textContent = hm;
        el.querySelector('.tm__ap').textContent = ap;
      };
      if (!animate || reduced) return apply();
      gsap.timeline()
        .to(el, { opacity: 0, y: -6, filter: 'blur(4px)', duration: 0.18, ease: 'power2.in' })
        .call(apply)
        .fromTo(el, { y: 6 }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: spring({ bounce: 0.3 }) });
    });
    document.querySelectorAll('[data-shift]').forEach((el) => {
      const label = dayShiftLabel(new Date(+el.dataset.shift));
      el.textContent = label;
      el.hidden = !label;
    });
  }
  refreshTimes(false);

  // "Show on map" buttons in the schedule
  daysEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto-location]');
    if (!b) return;
    sound.tap();
    document.dispatchEvent(new CustomEvent('ausmc:location', { detail: b.dataset.gotoLocation }));
    const v = document.getElementById('venue');
    lenis ? lenis.scrollTo(v, { offset: -80, duration: 1.6 }) : v.scrollIntoView({ behavior: 'smooth' });
  });

  setupLanding({ reduced });
  setupLive({ lenis });
  setupReminders();

  // the sticky day switcher bows out as the schedule ends
  gsap.fromTo('.daynav', { opacity: 1, y: 0 }, {
    opacity: 0, y: -24, ease: 'none',
    scrollTrigger: { trigger: '.schedule', start: 'bottom 45%', end: 'bottom 25%', scrub: true },
  });
}

// Rows drop in one by one with spring physics as each block scrolls into view
function setupLanding({ reduced }) {
  document.querySelectorAll('.day').forEach((day) => {
    const head = day.querySelector('.day__head');
    const num = day.querySelector('.day__num');
    if (!reduced) {
      gsap.fromTo(num, { yPercent: 30, opacity: 0, '--w': 62 }, {
        yPercent: 0, opacity: 1, '--w': 125, duration: 1.6, ease: 'expo.out',
        scrollTrigger: { trigger: head, start: 'top 85%', once: true },
      });
      gsap.to(num, { yPercent: -25, ease: 'none', scrollTrigger: { trigger: day, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
      gsap.fromTo(head.querySelector('.day__meta').children, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: spring({ bounce: 0.25 }),
        scrollTrigger: { trigger: head, start: 'top 85%', once: true },
      });
    }
  });

  let tickIndex = 0;
  document.querySelectorAll('.block').forEach((block) => {
    const head = block.querySelectorAll('.block__head, .cols-head');
    const rows = block.querySelectorAll('.row');
    const rail = block.querySelector('.timeline__rail');

    if (reduced) {
      gsap.set(block, { opacity: 0 });
      ScrollTrigger.create({ trigger: block, start: 'top 90%', once: true, onEnter: () => gsap.to(block, { opacity: 1, duration: 0.6 }) });
      return;
    }

    gsap.set(block, { opacity: 0, y: 70, scale: 0.97, rotationX: 8, transformPerspective: 1400, transformOrigin: '50% 0%' });
    gsap.set(head, { opacity: 0, y: -14 });
    gsap.set(rows, { opacity: 0, y: -70, rotationX: -62, rotationZ: () => (Math.random() - 0.5) * 3, transformPerspective: 900, transformOrigin: '50% 0%' });
    if (rail) gsap.set(rail, { scaleY: 0, transformOrigin: '50% 0%' });

    ScrollTrigger.create({
      trigger: block,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        const tl = gsap.timeline();
        tl.to(block, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 0);
        tl.to(block, { y: 0, scale: 1, rotationX: 0, duration: 1.1, ease: spring({ bounce: 0.22 }) }, 0);
        tl.to(head, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: spring({ bounce: 0.3 }) }, 0.15);
        if (rail) tl.to(rail, { scaleY: 1, duration: 0.11 * rows.length + 0.5, ease: 'power2.out' }, 0.3);
        rows.forEach((row, i) => {
          const at0 = 0.3 + i * 0.085;
          tl.to(row, { opacity: 1, duration: 0.22, ease: 'none' }, at0);
          tl.to(row, { y: 0, rotationX: 0, rotationZ: 0, duration: 0.95, ease: spring({ bounce: 0.42, velocity: 0.6 }) }, at0);
          tl.call(() => {
            row.classList.add('is-landed');
            sound.tick(tickIndex++ % 9 === 0 ? 0 : i);
          }, null, at0 + 0.17);
        });
        tickIndex = 0;
      },
    });
  });

  // headings: rise + un-blur per word
  document.querySelectorAll('.section-head').forEach((h) => {
    if (reduced) return;
    gsap.fromTo(h.children, { opacity: 0, y: 50, filter: 'blur(10px)' }, {
      opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, stagger: 0.1, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 85%', once: true },
    });
  });
}

// LIVE / UP NEXT / past states, the timeline progress fill and the live toast
function setupLive({ lenis }) {
  const toast = document.querySelector('.live-toast');
  let toastKey = '';

  const update = () => {
    const now = new Date();
    const { sessions, live, next, isEventDay, today } = liveState(now);
    const liveKeys = new Set(live.map((s) => s.key));
    const nextKey = next?.key;

    document.querySelectorAll('[data-key]').forEach((el) => {
      const key = el.dataset.key;
      const s = sessions.find((x) => x.key === key);
      if (!s) return;
      const isLive = liveKeys.has(key);
      const isPast = isEventDay && now >= s.end && sessionDayIs(s, today);
      el.classList.toggle('is-live', isLive);
      el.classList.toggle('is-next', key === nextKey && !isLive);
      el.classList.toggle('is-past', isPast);
      const target = el.querySelector('.status');
      if (target) target.innerHTML = isLive ? '<span class="badge badge--live"><span class="live-dot"></span>Live</span>' : key === nextKey ? '<span class="badge badge--next">Up next</span>' : '';
    });

    // timeline progress fill for today's program
    document.querySelectorAll('.block--program').forEach((block) => {
      const rows = [...block.querySelectorAll('.row--session')];
      const fill = block.querySelector('.timeline__fill');
      if (!rows.length || !fill) return;
      const keys = rows.map((r) => sessions.find((s) => s.key === r.dataset.key)).filter(Boolean);
      const first = keys[0];
      const last = keys[keys.length - 1];
      let p = 0;
      if (now >= last.end) p = 1;
      else if (now > first.start) {
        const idx = keys.findIndex((s) => now < s.end);
        const s = keys[idx];
        const local = Math.min(1, Math.max(0, (now - s.start) / (s.end - s.start)));
        const row = rows[idx];
        const top = row.offsetTop + 28 + local * (row.offsetHeight - 28);
        p = top / block.querySelector('.timeline').offsetHeight;
      }
      fill.style.transform = `scaleY(${Math.min(1, p)})`;
    });

    // live toast
    const current = live[live.length - 1];
    const key = current ? current.key : '';
    if (key !== toastKey) {
      toastKey = key;
      if (current) {
        const el = document.querySelector(`[data-key="${current.key}"]`);
        const endTxt = timeParts(current.end);
        toast.innerHTML = `<span class="badge badge--live"><span class="live-dot"></span>Live</span><span class="live-toast__title">${esc(current.title)}</span><span class="live-toast__until">until ${endTxt.hm} ${endTxt.ap}</span><button type="button">View</button>`;
        toast.hidden = false;
        gsap.fromTo(toast, { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: spring({ bounce: 0.35 }) });
        toast.querySelector('button').onclick = () => {
          sound.tap();
          lenis ? lenis.scrollTo(el, { offset: -200, duration: 1.4 }) : el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
      } else if (!toast.hidden) {
        gsap.to(toast, { y: 80, opacity: 0, duration: 0.4, onComplete: () => (toast.hidden = true) });
      }
    }
  };
  update();
  setInterval(update, 20000);
}

function sessionDayIs(s, today) {
  return DAYS.find((d) => d.id === s.dayId)?.date === today;
}

// ───────────── reminders: add any entry to the visitor's calendar ─────────────
const BASE = import.meta.env.BASE_URL;
const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STORE = 'ausmc:reminders';
const icsUrl = (name) => new URL(`${BASE}ics/${name}.ics`, location.href).href;

function setupReminders() {
  const entries = Object.fromEntries(calendarEntries().map((e) => [e.key, e]));
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { /* private mode */ }
  const markSet = (key) => {
    document.querySelectorAll(`[data-remind="${key}"]`).forEach((b) => {
      b.classList.add('is-set');
      b.title = 'Added to your calendar';
    });
    if (!saved.includes(key)) saved.push(key);
    try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* ignore */ }
  };
  saved.forEach((k) => document.querySelectorAll(`[data-remind="${k}"]`).forEach((b) => b.classList.add('is-set')));

  const when = (d) => new Intl.DateTimeFormat('en-AU', { timeZone: tzState.mode === 'sydney' ? SYD : undefined, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(d).replace(/\b(am|pm)\b/g, (m) => m.toUpperCase());

  const menu = document.createElement('div');
  menu.className = 'remind-menu glass';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <p class="remind-menu__title"></p>
    <p class="remind-menu__time"></p>
    <button type="button" role="menuitem" data-cal="apple">${icon('calendar')}<span>Apple Calendar · iPhone · Mac</span></button>
    <button type="button" role="menuitem" data-cal="google">${icon('calendar')}<span>Google Calendar</span></button>
    <button type="button" role="menuitem" data-cal="outlook">${icon('calendar')}<span>Outlook</span></button>
    <p class="remind-menu__note">${icon('bell')} Includes an alert 15 minutes before.</p>`;
  document.body.appendChild(menu);
  let current = null;

  const close = () => {
    if (menu.hidden) return;
    gsap.to(menu, { opacity: 0, y: -6, scale: 0.97, duration: 0.18, ease: 'power2.in', onComplete: () => (menu.hidden = true) });
    current = null;
  };
  const open = (btn, e) => {
    current = { btn, e };
    menu.querySelector('.remind-menu__title').textContent = e.short;
    menu.querySelector('.remind-menu__time').textContent = `${when(e.start)} · ${tzState.mode === 'sydney' ? 'Sydney time' : 'your time'}`;
    menu.hidden = false;
    const r = btn.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const left = Math.min(Math.max(12, r.right - mw), innerWidth - mw - 12);
    const below = r.bottom + 10 + mh < innerHeight;
    menu.style.left = `${left}px`;
    menu.style.top = `${below ? r.bottom + 10 : r.top - mh - 10}px`;
    menu.style.transformOrigin = `${r.left + r.width / 2 - left}px ${below ? 0 : mh}px`;
    gsap.fromTo(menu, { opacity: 0, y: below ? -8 : 8, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: spring({ bounce: 0.3 }) });
    menu.querySelector('button').focus({ preventScroll: true });
  };

  const add = (kind, key, e) => {
    if (kind === 'apple') location.href = icsUrl(key);
    else window.open(kind === 'google' ? googleUrl(e) : outlookUrl(e), '_blank', 'noopener');
    markSet(key);
    const b = document.querySelector(`[data-remind="${key}"]`);
    if (b) gsap.fromTo(b, { scale: 0.8 }, { scale: 1, duration: 0.6, ease: spring({ bounce: 0.55 }) });
    sound.softPop({ pitch: 1.15, gain: 0.07 });
  };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remind]');
    if (b) {
      ev.stopPropagation();
      const key = b.dataset.remind;
      const e = entries[key];
      if (!e) return;
      sound.softPop({ gain: 0.06 });
      // iPhone / iPad: one tap straight into the native "Add to Calendar" sheet
      if (IOS) return add('apple', key, e);
      if (current?.btn === b) return close();
      return open(b, e);
    }
    const choice = ev.target.closest('[data-cal]');
    if (choice && current) {
      add(choice.dataset.cal, current.btn.dataset.remind, current.e);
      return close();
    }
    if (!ev.target.closest('.remind-menu')) close();
  });
  addEventListener('keydown', (ev) => ev.key === 'Escape' && close());
  addEventListener('scroll', close, { passive: true });

  // the whole schedule in one go
  const full = document.querySelector('.full-cal');
  full?.addEventListener('click', () => {
    sound.softPop({ gain: 0.06 });
    location.href = icsUrl(FULL_ICS);
  });
}
