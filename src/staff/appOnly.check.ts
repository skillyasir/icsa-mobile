import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { run } from '../../scripts/check-harness.ts';
import { strip } from '../../scripts/strip.ts';

import { locationCheckLine } from './rules.ts';

// AMS note 08 (14 Nov 2026, AMS 5183bc65): staff check in through the app only,
// and the staff area is one radius for every branch (250 m by default, set by a
// manager), sent on /me/today as branch.radius_m. The app draws what the AMS
// sends, never a number of its own, and never sends anyone to the website to
// check in.

run('appOnly.check — the staff area as the AMS sends it, and no website check-in (AMS note 08)', (h) => {
  h.check('§1 the area is the AMS’s radius, said in metres', locationCheckLine({ name: 'City Branch', radius_m: 250 }) === 'Location — within 250 m of City Branch');
  h.check('§1 …whatever a manager sets it to', locationCheckLine({ name: 'Mahboula', radius_m: 300 }) === 'Location — within 300 m of Mahboula');
  h.check('§1 no radius sent: no number invented', locationCheckLine({ name: 'Mahboula', radius_m: null }) === 'Location — inside Mahboula' && locationCheckLine(null) === 'Location — inside your branch');
  const day = strip(readFileSync(new URL('./MyDayScreen.tsx', import.meta.url), 'utf8'));
  h.check('§2 My day reads (floor) and says the area from /me/today', day.length > 5000 && /locationCheckLine\(day\.branch\)/.test(day) && !/\b(150|250|400) ?m\b/.test(day));
  const SRC = new URL('../', import.meta.url).pathname;
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.check\.ts$/.test(f)) files.push(p);
    }
  };
  walk(SRC);
  h.check('§3 the app’s sources were read (floor)', files.length > 60, String(files.length));
  const web = files.filter((f) => /check[ -]?in (on|from) the (website|web|computer)|registered PC|office PC|this_computer/i.test(strip(readFileSync(f, 'utf8'))));
  h.check('§3 nothing sends staff to the website or a PC to check in, nor reads this_computer', web.length === 0, web.map((f) => f.slice(SRC.length)).join(', '));
});
