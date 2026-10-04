// Writes one .ics file per schedule entry (+ the full schedule) to public/ics/.
// iPhone Safari opens these straight into the native "Add to Calendar" sheet.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { calendarEntries, toICS, FULL_ICS } from '../src/lib/calendar.js';

const dir = new URL('../public/ics/', import.meta.url);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const list = calendarEntries();
for (const e of list) writeFileSync(new URL(`${e.key}.ics`, dir), toICS([e], { name: `AusMC 2026 · ${e.short}` }));
writeFileSync(new URL(`${FULL_ICS}.ics`, dir), toICS(list, { name: 'AusMC 2026 · Official Schedule' }));
console.log(`ics: ${list.length} entries + full schedule`);
