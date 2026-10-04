import { EVENT, DAYS } from '../data/schedule.js';

export const SYD = EVENT.timeZone;

/** A Sydney wall-clock date + time ("2026-10-09", "14:30") → absolute Date */
export const at = (date, hm) => new Date(`${date}T${hm}:00${EVENT.offset}`);

export const eventStart = at(EVENT.start.date, EVENT.start.time);
export const eventEnd = at(EVENT.end.date, EVENT.end.time);

const fmts = new Map();
function fmt(opts, tz) {
  const key = JSON.stringify(opts) + (tz || 'local');
  if (!fmts.has(key)) {
    try {
      fmts.set(key, new Intl.DateTimeFormat('en-US', tz ? { ...opts, timeZone: tz } : opts));
    } catch {
      fmts.set(key, new Intl.DateTimeFormat('en-US', opts));
    }
  }
  return fmts.get(key);
}

export const tzState = { mode: 'sydney' };

const localZone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return SYD; }
})();

/** Does the visitor's clock show different times than Sydney during the event? */
export const localDiffers = (() => {
  if (!localZone || localZone === SYD) return false;
  const probe = at('2026-10-10', '12:00');
  const o = { hour: 'numeric', minute: '2-digit', day: 'numeric' };
  return fmt(o).format(probe) !== fmt(o, SYD).format(probe);
})();

export function localZoneLabel() {
  try {
    const p = fmt({ timeZoneName: 'short', hour: 'numeric' }).formatToParts(eventStart);
    return p.find((x) => x.type === 'timeZoneName')?.value || 'Local';
  } catch { return 'Local'; }
}

const activeTz = () => (tzState.mode === 'sydney' ? SYD : undefined);

/** { hm: "9:00", ap: "AM" } in the active time zone */
export function timeParts(date) {
  const parts = fmt({ hour: 'numeric', minute: '2-digit', hour12: true }, activeTz()).formatToParts(date);
  let hm = '';
  let ap = '';
  for (const p of parts) {
    if (p.type === 'hour' || p.type === 'minute') hm += p.value;
    else if (p.type === 'literal' && p.value.trim() === ':') hm += ':';
    else if (p.type === 'dayPeriod') ap = p.value.toUpperCase();
  }
  return { hm, ap };
}

export const timeText = (d) => { const { hm, ap } = timeParts(d); return `${hm} ${ap}`; };

/** When showing local time, a short label if the local calendar day differs from Sydney's */
export function dayShiftLabel(date) {
  if (tzState.mode === 'sydney') return '';
  const o = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (fmt(o).format(date) === fmt(o, SYD).format(date)) return '';
  return fmt({ weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/** Sydney calendar date (YYYY-MM-DD) for a given instant */
export function sydneyDate(d = new Date()) {
  const p = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }, SYD).formatToParts(d);
  const get = (t) => p.find((x) => x.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Flattened, time-resolved list of every session (used for live / up-next) */
export function allSessions() {
  const out = [];
  for (const day of DAYS) {
    for (const [bi, block] of day.blocks.entries()) {
      if (block.type === 'feature') continue;
      if (block.type === 'masterclass') {
        out.push({ dayId: day.id, key: `${day.id}-b${bi}`, title: block.title, start: at(day.date, block.start), end: at(day.date, block.end) });
        continue;
      }
      block.sessions.forEach((s, si) => {
        const next = block.sessions[si + 1];
        const endHm = s.end || (next ? next.start : null);
        const start = at(day.date, s.start);
        const end = endHm ? at(day.date, endHm) : new Date(start.getTime() + 60 * 60 * 1000);
        out.push({ dayId: day.id, key: `${day.id}-b${bi}-s${si}`, title: block.type === 'online' ? `${block.title} · ${s.title}` : s.title, start, end });
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export function liveState(now = new Date()) {
  const sessions = allSessions();
  const live = sessions.filter((s) => now >= s.start && now < s.end);
  const today = sydneyDate(now);
  const isEventDay = DAYS.some((d) => d.date === today);
  const next = isEventDay ? sessions.find((s) => s.start > now && sydneyDate(s.start) === today) : null;
  return { sessions, live, next, isEventDay, today };
}

// ───────────── Sydney ⇄ visitor time ─────────────
export { localZone };

/** switch every clock and schedule time between Sydney and the visitor's zone */
export function setTzMode(mode) {
  if (tzState.mode === mode) return;
  tzState.mode = mode;
  document.dispatchEvent(new CustomEvent('ausmc:tz', { detail: mode }));
}

/** UTC offset of a zone in minutes at a given instant */
export function offsetMinutes(tz, date = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || 'GMT';
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(part);
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0;
  } catch {
    return -date.getTimezoneOffset();
  }
}

export const zoneCity = (tz) => (tz || '').split('/').pop().replace(/_/g, ' ');
