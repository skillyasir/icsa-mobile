import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { amsDir, amsFirewallAdmits, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  KINDS,
  KIND_LABEL,
  REMINDER_PREFIX,
  STAFF_API,
  addRouterBody,
  lateMinutes,
  lateWord,
  lunchNow,
  nextTap,
  proofBody,
  reasonLine,
  reminderPlan,
  tapBody,
  tapButton,
  timeline,
  type MyDay,
} from './rules.ts';

// Staff attendance in the app (13 Nov 2026): My day, Office Wi-Fi and the
// reminders, held to the AMS's own routes, controller and service
// (server/src/routes/staffAttendance.js, controllers/staffAttendanceController.js,
// services/staffAttendance.js — the one owner of the rules).

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));
/** A function's body by name: past its parameters (parentheses matched, so a destructured one is skipped), then its braces. */
function bodyOf(src: string, name: string): string {
  const at = src.search(new RegExp(`(const|function)\\s+${name}\\b`));
  if (at < 0) return '';
  let i = src.indexOf('(', at);
  if (i < 0) return '';
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) break;
  }
  const open = src.indexOf('{', i);
  if (open < 0 || !/^\)\s*(=>)?\s*$/.test(src.slice(i, open))) return '';
  for (let depth = 0, j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  return '';
}

const DAY: MyDay = {
  date: '2026-11-13',
  now: '09:00',
  working: true,
  reason: null,
  day: { place: 'office', work_mode: 'onsite', start_time: '09:30', end_time: '18:30', break_minutes: 60, branch_id: 'b1' },
  branch: { id: 'b1', name: 'City Branch', latitude: 29.37, longitude: 47.97, radius_m: 150 },
  taps: [],
  next: ['in'],
  upcoming: [
    { date: '2026-11-15', place: 'office', start_time: '09:30', end_time: '18:30', break_minutes: 60 },
    { date: '2026-11-16', place: 'online', start_time: '10:00', end_time: '14:00', break_minutes: 0 },
    { date: '2026-11-13', place: 'office', start_time: '09:30', end_time: '18:30', break_minutes: 60 },
  ],
  rules: { late_grace_min: 5, lunch_grace_min: 5, remind_not_in: true, remind_not_in_after_min: 10, remind_lunch_end: true, remind_lunch_before_min: 5 },
};
const tap = (kind: MyDay['taps'][number]['kind'], time: string, extra: Partial<MyDay['taps'][number]> = {}): MyDay['taps'][number] => ({
  id: kind, kind, time, place: 'office', branch_name: 'City Branch', location_ok: true, wifi_ok: true, review: 'none', review_reason: null, distance_m: 12, late_min: 0, ...extra,
});

run('staff.check — My day, Office Wi-Fi and the reminders agree with the AMS', (h) => {
  // §0 the helpers
  h.check('§0 strip removes comments and keeps strings', strip("a('x') // gone\n/* gone */b").includes("a('x')") && !strip('a // gone').includes('gone'));
  h.check('§0 bodyOf extracts an arrow and a declaration, nested braces whole',
    bodyOf('const f = (a) => { if (a) { return 1; } return 2; };', 'f') === '{ if (a) { return 1; } return 2; }' &&
    bodyOf('function g({ x }) { return { y: x }; }', 'g') === '{ return { y: x }; }' &&
    bodyOf('const h = async (req, res) => { a(); };', 'h') === '{ a(); }' &&
    bodyOf('nothing here', 'f') === '');

  // §1 every endpoint is routed, under /api/staff-attendance, to the right roles
  const routes = strip(readAmsFile('server/src/routes/staffAttendance.js'));
  const index = strip(readAmsFile('server/src/index.js'));
  h.check('§1 the AMS routes were read (floor)', routes.length > 800 && index.length > 5000, `${routes.length}/${index.length}`);
  h.check('§1 the router is mounted at /api/staff-attendance', /app\.use\(\s*'\/api\/staff-attendance'/.test(index));
  const staff = /const STAFF = \[([^\]]*)\]/.exec(routes)?.[1] ?? '';
  const words = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const STAFF_ROLES = ['manager', 'supervisor', 'accountant', 'teacher', 'marketer', 'cap_coordinator', 'invoice_encoder'];
  h.check('§1 every staff role may use My day (the seven, as the AMS lists them)', STAFF_ROLES.every((r) => words(staff).includes(r)) && !words(staff).includes('student'), words(staff).join());
  const MANAGER_ONLY = new Set(['offices', 'addRouter', 'removeRouter']);
  const eps = Object.entries(STAFF_API);
  h.check('§1 six endpoints (cardinality)', eps.length === 6);
  for (const [key, e] of eps) {
    const sub = e.path.replace('/staff-attendance', '');
    const m = new RegExp(`router\\.${e.method.toLowerCase()}\\('${sub.replace(/[/:]/g, (c) => '\\' + c)}',\\s*auth,\\s*authorize\\(([^)]*)\\)`).exec(routes);
    const who = m ? m[1] : '';
    const ok = MANAGER_ONLY.has(key) ? words(who).join() === 'manager' : who.trim() === '...STAFF';
    h.check(`§1 ${e.method} ${e.path} is routed${MANAGER_ONLY.has(key) ? ', manager only' : ', every staff role'}`, !!m && ok, who);
  }
  const admits = amsFirewallAdmits();
  h.check('§1 no staff-attendance path is open to a student token (the firewall refuses them all)', eps.every(([, e]) => !admits(e.method, '/api' + e.path.replace(':id', '00000000-0000-0000-0000-000000000000'))));

  // §2 what a tap sends is what the AMS reads — latitude / longitude, NOT lat / lng
  const ctl = strip(readAmsFile('server/src/controllers/staffAttendanceController.js'));
  const readPos = bodyOf(ctl, 'readPosition');
  const prove = bodyOf(ctl, 'proveAt');
  const tapFn = bodyOf(ctl, 'tap');
  h.check('§2 the controller functions extract (floor)', readPos.length > 200 && prove.length > 400 && tapFn.length > 1500, `${readPos.length}/${prove.length}/${tapFn.length}`);
  const amsReads = new Set([
    ...[...readPos.matchAll(/body\.(\w+)/g)].map((m) => m[1]),
    ...[...prove.matchAll(/body(?:\s*&&\s*body)?\.(\w+)/g)].map((m) => m[1]),
    ...[...tapFn.matchAll(/req\.body(?:\s*&&\s*req\.body)?\.(\w+)/g)].map((m) => m[1]),
  ]);
  // `client` (AMS ce93ec75, 13 Nov 2026): 'web' marks a WEBSITE tap (office network or a
  // registered PC); absent is the app — so the app reads as the app by NOT sending it.
  const want = ['kind', 'latitude', 'longitude', 'accuracy', 'mocked', 'bssid', 'ssid', 'app_platform', 'client'];
  h.check('§2 the AMS reads exactly these tap fields', want.every((k) => amsReads.has(k)) && [...amsReads].every((k) => want.includes(k)), [...amsReads].sort().join());
  const body = tapBody('in', { lat: 29.37, lng: 47.97, accuracy: 12, mocked: false }, { bssid: 'a4:2b:b0:7e:1:3c', ssid: 'ICSA-City' }, 'ios');
  const appSends = want.filter((k) => k !== 'client');
  h.check('§2 a tap sends every field the AMS reads, and nothing else', Object.keys(body).sort().join() === [...appSends].sort().join(), Object.keys(body).join());
  h.check('§2 …and never `client`: the app must not read as a website tap', !('client' in body) && /client === 'web'/.test(readAmsFile('server/src/controllers/staffAttendanceController.js')));
  h.check('§2 …the position as latitude / longitude, never lat / lng', body.latitude === 29.37 && body.longitude === 47.97 && !('lat' in body) && !('lng' in body));
  h.check('§2 …the router address exactly as the phone gave it (the AMS normalises it)', body.bssid === 'a4:2b:b0:7e:1:3c');
  h.check('§2 …mocked is a boolean the AMS compares with === true', body.mocked === false && /body\.mocked === true/.test(prove));
  const online = tapBody('in', null, null, 'android');
  h.check('§2 an online day sends the kind and the platform only', Object.keys(online).sort().join() === 'app_platform,kind');
  h.check('§2 a re-check sends the same proofs, without the kind', !('kind' in proofBody({ lat: 1, lng: 2, accuracy: null }, null)) && proofBody({ lat: 1, lng: 2, accuracy: null }, null).latitude === 1);
  const add = addRouterBody('b1', { bssid: 'a4:2b:b0:7e:11:3c', ssid: 'ICSA-City' }, { lat: 29.37, lng: 47.97, accuracy: 9 }, null);
  const addFn = bodyOf(ctl, 'addRouter');
  h.check('§2 Add this router sends what addRouter reads (branch_id, bssid, ssid, the position as evidence)',
    addFn.length > 800 && add.branch_id === 'b1' && add.bssid === 'a4:2b:b0:7e:11:3c' && add.latitude === 29.37 && /b\.branch_id/.test(addFn) && /b\.bssid/.test(addFn) && /readPosition\(b\)/.test(addFn) && /b\.mocked !== true/.test(addFn));

  // §3 the AMS's rules, held by its own service
  const require = createRequire(import.meta.url);
  const SA = require(resolve(amsDir(), 'server/src/services/staffAttendance.js')) as {
    KINDS: string[];
    KIND_LABEL: Record<string, string>;
    lateMinutes: (t: string, s: string, g: number) => number;
  };
  h.check('§3 the four kinds, in the AMS order', JSON.stringify(SA.KINDS) === JSON.stringify(KINDS));
  h.check('§3 the labels are the AMS’s word for word', JSON.stringify(SA.KIND_LABEL) === JSON.stringify(KIND_LABEL));
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  let pairs = 0;
  let differ = '';
  for (const grace of [0, 5, 10, 60]) {
    for (let s = 0; s < 1440; s += 15) {
      for (let t = 0; t < 1440; t++) {
        pairs++;
        if (SA.lateMinutes(hm(t), hm(s), grace) !== lateMinutes(hm(t), hm(s), grace) && !differ) differ = `${hm(t)} after ${hm(s)}, grace ${grace}`;
      }
    }
  }
  h.check(`§3 lateness agrees with the AMS minute by minute (${pairs} pairs)`, pairs === 4 * 96 * 1440 && !differ, differ);

  // §4 the screen follows the AMS's order and words
  h.check('§4 the one button is the first tap the AMS allows', nextTap(DAY) === 'in' && nextTap({ ...DAY, next: [] }) === null && nextTap({ ...DAY, working: false }) === null);
  h.check('§4 lateness reads in minutes, and in hours from an hour', lateWord(0) === 'on time' && lateWord(7) === '7 min late' && lateWord(60) === '1 h late' && lateWord(272) === '4 h 32 min late');
  h.check('§4 a review reason drops the heading its card already says', reasonLine('Kept for review: office Wi-Fi not recognised.') === 'Office Wi-Fi not recognised.' && reasonLine('Neither office check passed: no location from the phone.') === 'Neither office check passed: no location from the phone.' && reasonLine(null) === null);
  h.check('§4 an online day starts and finishes work', tapButton('in', 'online') === 'Start work' && tapButton('out', 'online') === 'Finish work' && tapButton('lunch_out', 'online') === 'Lunch out');
  h.check('§4 four timeline rows with a break, two without', timeline(DAY).length === 4 && timeline({ ...DAY, day: { ...DAY.day!, break_minutes: 0 } }).map((r) => r.kind).join() === 'in,out');
  const onLunch: MyDay = { ...DAY, now: '13:50', taps: [tap('in', '09:24'), tap('lunch_out', '13:32')], next: ['lunch_in'] };
  const l = lunchNow(onLunch);
  h.check('§4 on lunch: since, back by, minutes used, over-break after break + grace', !!l && l.since === '1:32 PM' && l.backBy === '2:32 PM' && l.usedMin === 18 && l.overAfterMin === 65, JSON.stringify(l));
  h.check('§4 …and the timeline says Back from lunch is due', timeline(onLunch).find((r) => r.kind === 'lunch_in')?.line === 'Due by 2:32 PM');
  const made = timeline({ ...DAY, taps: [tap('in', '09:41', { late_min: 11, wifi_ok: false, review: 'pending' })] })[0];
  h.check('§4 a tap made shows its time, lateness and both checks', made.time === '9:41 AM' && made.line === '11 min late · Location ✓ Wi-Fi ✗ · kept for review', made.line);
  const screen = read('./MyDayScreen.tsx');
  h.check('§4 My day draws the AMS’s next list and never works out the order itself', /day\.next/.test(screen) && !/nextKinds|orderRefusal/.test(screen + read('./rules.ts')));
  h.check('§4 the location and Wi-Fi are read only inside a tap or a re-check (never on load)', /const send = async[\s\S]*readProofs\(\)/.test(screen) && /const recheck = async[\s\S]*readProofs\(\)/.test(screen) && (screen.match(/await readProofs\(\)/g)?.length ?? 0) === 2 && !/useEffect\([^)]*read(Fix|Wifi|Proofs)/.test(screen));

  // §5 the reminders (Yasir, 11 Nov 2026: the person only; nothing on the lock screen that names them)
  const plan = reminderPlan(DAY);
  h.check('§5 not checked in: today and each upcoming day, start + 10, Kuwait time', plan.map((r) => `${r.id}@${r.at}`).join() ===
    ['staff-in-2026-11-13@2026-11-13T09:40:00+03:00', 'staff-in-2026-11-15@2026-11-15T09:40:00+03:00', 'staff-in-2026-11-16@2026-11-16T10:10:00+03:00'].join(), plan.map((r) => r.id).join());
  h.check('§5 …the words say what is due, never a name', plan[0]?.body === 'You have not checked in yet — your day started at 9:30 AM.');
  h.check('§5 …none for today once checked in, or once the time has passed', !reminderPlan({ ...DAY, taps: [tap('in', '09:24')] }).some((r) => r.id === 'staff-in-2026-11-13') && !reminderPlan({ ...DAY, now: '09:45' }).some((r) => r.id === 'staff-in-2026-11-13'));
  h.check('§5 …none when a manager switched it off', reminderPlan({ ...DAY, rules: { ...DAY.rules, remind_not_in: false } }).length === 0);
  const lunchPlan = reminderPlan(onLunch);
  h.check('§5 lunch ending: break − 5 min after Lunch out, today only', lunchPlan.some((r) => r.id === 'staff-lunch-2026-11-13' && r.at === '2026-11-13T14:27:00+03:00' && r.body === 'Your lunch break ends at 2:32 PM.'), lunchPlan.map((r) => r.id + '@' + r.at).join());
  h.check('§5 …none once back from lunch', !reminderPlan({ ...onLunch, taps: [...onLunch.taps, tap('lunch_in', '14:20')] }).some((r) => r.id.startsWith('staff-lunch')));
  h.check('§5 every reminder is a staff- id at a +03:00 instant', [...plan, ...lunchPlan].every((r) => r.id.startsWith(REMINDER_PREFIX) && r.at.endsWith('+03:00')));
  const session = read('../session/SessionContext.tsx');
  h.check('§5 sign-out clears every staff reminder before the person goes', /const signOut = useCallback\(async \(\) => \{[\s\S]*?await clearReminders\(\);[\s\S]*?setUser\(null\)/.test(session));

  // §6 a build without the new native modules must not crash at import
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
  const statics = files.filter((f) => /^\s*import\s+(?!type\b)[^;]*from\s+'(@react-native-community\/netinfo|expo-notifications)'/m.test(strip(readFileSync(f, 'utf8'))));
  const lazies = files.filter((f) => /require\('(@react-native-community\/netinfo|expo-notifications)'\)/.test(strip(readFileSync(f, 'utf8'))));
  h.check('§6 the app was read (floor: 80 files)', files.length >= 80, String(files.length));
  h.check('§6 NetInfo and expo-notifications are required lazily, inside a try — never imported at the top', statics.length === 0 && lazies.length === 2, `static: ${statics.map((f) => f.slice(SRC.length)).join(', ')} · lazy: ${lazies.length}`);

  // §7 who sees what
  const me = read('../navigation/MeScreen.tsx');
  h.check('§7 Me: My day for every member of staff, Office Wi-Fi for a manager', /user\.role !== 'student'[\s\S]*'\/my-day'/.test(me) && /user\.role === 'manager'[\s\S]*'\/office-wifi'/.test(me));
  h.check('§7 My day is on a view’s first tab, the teacher’s Today and the web-only screen',
    /name === 'index' \? <StaffDayCard \/>/.test(read('../navigation/TabPlaceholder.tsx')) && /<StaffDayCard \/>/.test(read('../teacher/TodayScreen.tsx')) && /<StaffDayCard \/>/.test(read('../app/web-only.tsx')));
  h.check('§7 a placeholder never says "Phase" to a member of staff', !/Phase/.test(read('../navigation/TabPlaceholder.tsx').replace(/\/\*[\s\S]*?\*\//g, '')));
});
