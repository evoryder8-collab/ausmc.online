// Calendar entries for every schedule item: .ics (Apple / iPhone / Outlook
// desktop), Google Calendar and Outlook.com links — each with the session
// name, its exact time (stored in UTC so it lands right in any time zone),
// the location and a 15-minute reminder.
import { DAYS, LOCATIONS } from '../data/schedule.js';
import { at } from './time.js';

export const SITE = 'https://ausmc.online/';
const PREFIX = 'AusMC 2026 · ';
const ALERT_MIN = 15;

const venue = LOCATIONS.venue.address;

export function calendarEntries() {
  const out = [];
  for (const day of DAYS) {
    day.blocks.forEach((block, bi) => {
      if (block.type === 'feature') return;
      if (block.type === 'masterclass') {
        block.sessions.forEach((s, pi) => {
          out.push({
            key: `${day.id}-b${bi}-p${pi}`,
            title: `Masterclass: ${s.title} (${s.presenter})`,
            short: s.title,
            start: at(day.date, block.start),
            end: at(day.date, block.end),
            location: venue,
            desc: `${block.title} with ${s.presenter}, ${s.role}.`,
            anchor: day.id,
          });
        });
        return;
      }
      block.sessions.forEach((s, si) => {
        const next = block.sessions[si + 1];
        const endHm = s.end || next?.start;
        const start = at(day.date, s.start);
        const end = endHm ? at(day.date, endHm) : new Date(start.getTime() + 3600e3);
        const online = block.type === 'online';
        const loc = s.location ? `${LOCATIONS[s.location].name}, ${LOCATIONS[s.location].address}` : online ? 'Live online' : venue;
        out.push({
          key: `${day.id}-b${bi}-s${si}`,
          title: online ? `${block.title}: ${s.title} (Live Online)` : s.title,
          short: online ? `${block.title} · ${s.title}` : s.title,
          start,
          end,
          location: loc,
          desc: [s.desc, s.address].filter(Boolean).join(' · '),
          anchor: day.id,
        });
      });
    });
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const details = (e) => [e.desc, `Official schedule: ${SITE}#${e.anchor}`].filter(Boolean).join('\n');

// RFC 5545: lines folded at 75 octets
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75;
    if (bytes + b > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function toICS(list, { name = 'AusMC 2026', stamp = new Date() } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AusMC//Official Schedule 2026//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Australia/Sydney'];
  for (const e of list) {
    L.push(
      'BEGIN:VEVENT',
      `UID:${e.key}@ausmc.online`,
      `DTSTAMP:${utc(stamp)}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(e.end)}`,
      `SUMMARY:${esc(PREFIX + e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(details(e))}`,
      `URL:${SITE}#${e.anchor}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${e.short} starts in ${ALERT_MIN} minutes`)}`,
      `TRIGGER:-PT${ALERT_MIN}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  L.push('END:VCALENDAR');
  return `${L.map(fold).join('\r\n')}\r\n`;
}

export function googleUrl(e) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: PREFIX + e.title, dates: `${utc(e.start)}/${utc(e.end)}`, details: details(e), location: e.location });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function outlookUrl(e) {
  const p = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: PREFIX + e.title, startdt: e.start.toISOString(), enddt: e.end.toISOString(), location: e.location, body: details(e) });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`;
}

export const FULL_ICS = 'ausmc-2026-full-schedule';
