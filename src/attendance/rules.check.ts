import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  ATTENDANCE_API,
  LOCATION_MAX_AGE_MS,
  LOCATION_REUSE_ACCURACY_M,
  LOCATION_TIMEOUT_MS,
  STUDENT_CHANGEABLE,
  batchGate,
  canChangeTeacher,
  changeUndoesMark,
  checkInBody,
  checkInLabel,
  checkOutBody,
  classTimes,
  distanceLine,
  formatClock,
  formatDay,
  formatTime,
  formatWeekdayDay,
  greeting,
  isClassDay,
  kd,
  kuwaitDay,
  lessonPct,
  locationPlan,
  mapBranch,
  myTeacherBody,
  regionFor,
  startsLabel,
  statusView,
  statusWord,
} from './rules.ts';

// The student's check-in (Phase 2 piece 1, 6 Nov 2026) touches four things
// that must agree, and none would say so if they drifted — the check-in would
// just fail on a phone, or show the wrong words:
//   the app's endpoints and fields ↔ the AMS routes, firewall and controller
//   the app's location rule        ↔ the website's (lib/geolocation.js) and the AMS default
//   the teacher-change rule        ↔ the AMS's STUDENT_CHANGEABLE and the web switch
//   dates and times                ↔ Kuwait (the AMS database runs in Asia/Kuwait)
// This check reads the AMS copy beside this repo; missing is COULD NOT RUN.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';
const list = (src: string) => [...src.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

run('rules.check — the student check-in agrees with the AMS', (h) => {
  // §0 the extractors
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');
  h.check('§0 body() finds nothing for a missing name', body('const a = async () => {\n};', 'zz') === '');
  h.check('§0 list() reads quoted words in order', JSON.stringify(list("['a', 'b_c']")) === '["a","b_c"]');
  h.check('§0 strip keeps a URL and drops a comment', strip("u = 'https://x'; // gone").includes('https://x') && !strip('a; // gone').includes('gone'));

  // §1 every endpoint is routed, for a student, and in the student firewall
  const routes = strip(readAmsFile('server/src/routes/attendance.js'));
  const authRoutes = strip(readAmsFile('server/src/routes/auth.js'));
  const firewall = strip(readAmsFile('server/src/middleware/studentFirewall.js'));
  h.check('§1 the AMS attendance routes were read', routes.length > 1000, String(routes.length));
  h.check('§1 the AMS firewall was read', firewall.length > 1500, String(firewall.length));
  const endpoints = Object.values(ATTENDANCE_API);
  h.check('§1 six endpoints (floor)', endpoints.length === 6, String(endpoints.length));
  for (const e of endpoints) {
    const [, mount, sub] = /^\/(attendance|auth)(\/.*)$/.exec(e.path) ?? [];
    const src = mount === 'attendance' ? routes : authRoutes;
    const verb = e.method.toLowerCase();
    const routed = new RegExp(`router\\.${verb}\\('${sub?.replace(/\//g, '\\/')}',\\s*auth,`).test(src);
    h.check(`§1 ${e.method} ${e.path} is routed in the AMS`, !!sub && routed);
    const allowed = new RegExp(`method: '${e.method}',\\s*path: '/api${e.path.replace(/\//g, '\\/')}'`).test(firewall);
    h.check(`§1 ${e.method} /api${e.path} is in the student firewall`, allowed);
  }

  // §2 the fields the app sends are the fields the AMS reads
  const ctl = strip(readAmsFile('server/src/controllers/attendanceController.js'));
  const checkIn = body(ctl, 'checkIn');
  const checkOut = body(ctl, 'checkOut');
  const myTeacher = body(ctl, 'changeMyTeacher');
  h.check('§2 checkIn extracts (floor)', checkIn.length > 4000, String(checkIn.length));
  h.check('§2 checkOut extracts (floor)', checkOut.length > 500, String(checkOut.length));
  h.check('§2 changeMyTeacher extracts (floor)', myTeacher.length > 1500, String(myTeacher.length));
  const read = new Set<string>();
  const destructured = /const \{ ([a-z_, ]+) \} = req\.body;/.exec(checkIn)?.[1] ?? '';
  destructured.split(',').map((s) => s.trim()).filter(Boolean).forEach((f) => read.add(f));
  for (const m of checkIn.matchAll(/req\.body\.([a-z_]+)/g)) read.add(m[1]);
  h.check('§2 the AMS checkIn reads a known set of fields (floor)', read.size >= 7, [...read].join(','));
  const full = checkInBody({
    enrollmentId: 'e', fix: { lat: 29.3, lng: 47.9, accuracy: 8, mocked: false }, teacherId: 't', platform: 'android',
  });
  const unread = Object.keys(full).filter((k) => !read.has(k));
  h.check('§2 every check-in field the app sends is one the AMS reads', unread.length === 0, unread.join(','));
  h.check('§2 the app sends all seven', Object.keys(full).length === 7, Object.keys(full).join(','));
  h.check('§2 checkOut reads enrollment_id', /const \{ enrollment_id \} = req\.body;/.test(checkOut) && Object.keys(checkOutBody('e')).join() === 'enrollment_id');
  h.check('§2 my-teacher reads attendance_id and teacher_id', /attendance_id: attendanceId, teacher_id: teacherId/.test(myTeacher)
    && Object.keys(myTeacherBody('a', 't')).sort().join() === 'attendance_id,teacher_id');
  h.check('§2 the AMS counts a mocked flag only as a boolean', /typeof req\.body\.mocked === 'boolean'/.test(checkIn));
  h.check('§2 the AMS knows the app names ios and android', /\['ios', 'android'\]\.includes\(req\.body\.app_platform\)/.test(checkIn));

  // §3 when the location is read — the website's rule, and the AMS's default
  const geo = strip(readAmsFile('client/src/lib/geolocation.js'));
  h.check('§3 the web location lib was read', geo.length > 1000, String(geo.length));
  h.check('§3 the web asks a hybrid student for a position', /if \(learningMode === "hybrid"\)/.test(geo));
  h.check('§3 the web reads none for anything not classroom', /if \(learningMode !== "classroom"\) \{ onCoords\(null, null, null\); return; \}/.test(geo));
  h.check('§3 the AMS treats no mode as classroom', /enrollment\.learning_mode \|\| 'classroom'/.test(checkIn));
  h.check('§3 classroom → required, hybrid → asked, online → none', locationPlan('classroom') === 'required' && locationPlan('hybrid') === 'asked' && locationPlan('online') === 'none');
  h.check('§3 no mode → required (the AMS default)', locationPlan(null) === 'required' && locationPlan(undefined) === 'required' && locationPlan('') === 'required');
  const timeout = /const DEFAULT_TIMEOUT_MS = (\d+);/.exec(geo)?.[1];
  h.check('§3 the phone waits as long as the website', Number(timeout) === LOCATION_TIMEOUT_MS, `${timeout} vs ${LOCATION_TIMEOUT_MS}`);
  const maxAge = /maximumAge: (\d+)/.exec(geo)?.[1];
  h.check('§3 it reuses a position as recent as the website does', Number(maxAge) === LOCATION_MAX_AGE_MS, `${maxAge} vs ${LOCATION_MAX_AGE_MS}`);
  const vague = /const VAGUE_ACCURACY_M = (\d+);/.exec(ctl)?.[1];
  h.check('§3 …only one the AMS calls precise enough to name a distance', Number(vague) === LOCATION_REUSE_ACCURACY_M, `${vague} vs ${LOCATION_REUSE_ACCURACY_M}`);
  h.check('§3 the online button says so', checkInLabel('online') === "I'm in my online class" && checkInLabel('hybrid') === 'Check in' && checkInLabel(null) === 'Check in');

  // §4 changing the teacher: the AMS's list, the web switch's condition
  const changeable = /const STUDENT_CHANGEABLE = \[([^\]]*)\];/.exec(ctl)?.[1] ?? '';
  h.check('§4 the AMS list was found', list(changeable).length > 0, changeable);
  h.check('§4 the app list is the AMS list', JSON.stringify(list(changeable)) === JSON.stringify([...STUDENT_CHANGEABLE]), changeable);
  const sw = strip(readAmsFile('client/src/components/attendance/MyTeacherSwitch.js'));
  h.check('§4 the web switch has the same condition', /already\.check_in_method === "student_self" && !already\.session_id\s*&& CHANGEABLE\.includes\(already\.status\)/.test(sw));
  const own = { check_in_method: 'student_self', session_id: null, status: 'pending' };
  h.check('§4 a student check-in, pending → may change', canChangeTeacher(own));
  h.check('§4 present and late → may change', canChangeTeacher({ ...own, status: 'present' }) && canChangeTeacher({ ...own, status: 'late' }));
  h.check('§4 awaiting review, absent, excused → may not', !canChangeTeacher({ ...own, status: 'pending_review' }) && !canChangeTeacher({ ...own, status: 'absent' }) && !canChangeTeacher({ ...own, status: 'excused' }));
  h.check('§4 a batch check-in (has a session) → may not', !canChangeTeacher({ ...own, session_id: 's' }));
  h.check('§4 entered by staff → may not', !canChangeTeacher({ ...own, check_in_method: 'manual' }));
  h.check('§4 no check-in → may not', !canChangeTeacher(null));
  h.check('§4 the web asks first unless pending; so does the app', /if \(already\.status !== "pending"\)/.test(sw) && !changeUndoesMark('pending') && changeUndoesMark('present'));

  // §5 every window state the AMS sends has words
  const ctx = body(ctl, 'getMyContext');
  h.check('§5 getMyContext extracts (floor)', ctx.length > 3000, String(ctx.length));
  const states = [...new Set([...ctx.matchAll(/windowState = '([a-z_]+)'/g)].map((m) => m[1]))].sort();
  h.check('§5 the AMS has four window states', states.join() === 'closed,no_session,not_yet_open,open', states.join());
  h.check('§5 only open lets a batch check in', states.every((s) => batchGate(s as never).open === (s === 'open')));
  h.check('§5 every closed state says why', states.filter((s) => s !== 'open').every((s) => (batchGate(s as never).note ?? '').length > 8));

  // §6 every status the AMS counts has a word and a line
  const hist = body(ctl, 'getMyHistory');
  const keys = Object.keys(JSON.parse(('{' + (/const summary = \{([^}]*)\}/.exec(hist)?.[1] ?? '') + '}').replace(/(\w+):/g, '"$1":')));
  const statuses = keys.filter((k) => k !== 'total');
  h.check('§6 the AMS counts six statuses', statuses.length === 6, statuses.join());
  h.check('§6 each has its own word', statuses.every((s) => statusWord(s) !== s), statuses.map(statusWord).join());
  h.check('§6 each has a line', statuses.every((s) => statusView(s, 'classroom', 'Ms. Sara').text.length > 3));
  h.check('§6 pending names the teacher', statusView('pending', 'classroom', 'Ms. Sara Khan').text === 'Waiting for Ms. Sara Khan to confirm');
  h.check('§6 online pending says the teacher confirms in class', statusView('pending', 'online', 'Ms. Sara').text.includes('confirms during class'));
  h.check('§6 the AMS writes pending_review for a mocked check-in', /mocked \? 'pending_review' : 'pending'/.test(checkIn) && statusWord('pending_review') === 'Awaiting review');

  // §7 Kuwait days and times — the AMS database runs in Asia/Kuwait
  const db = strip(readAmsFile('server/src/config/db.js'));
  h.check("§7 the AMS database runs in Asia/Kuwait", /const APP_TIME_ZONE = 'Asia\/Kuwait';/.test(db));
  h.check('§7 a DATE as Kuwait midnight in UTC reads as its own day', kuwaitDay('2026-11-05T21:00:00.000Z') === '2026-11-06');
  h.check('§7 a plain date reads as itself', kuwaitDay('2026-11-06') === '2026-11-06' && formatDay('2026-11-06') === '6 Nov 2026');
  h.check('§7 "6 Nov 2026" from both shapes', formatDay('2026-11-05T21:00:00.000Z') === '6 Nov 2026');
  h.check('§7 late evening UTC is the next Kuwait day', kuwaitDay('2026-11-06T22:30:00Z') === '2026-11-07');
  h.check('§7 the weekday', formatWeekdayDay('2026-11-06') === 'Friday, 6 Nov 2026', formatWeekdayDay('2026-11-06'));
  h.check('§7 12:41 UTC is 3:41 PM in Kuwait', formatTime('2026-11-06T12:41:00.000Z') === '3:41 PM', formatTime('2026-11-06T12:41:00.000Z'));
  h.check('§7 21:05 UTC is 12:05 AM', formatTime('2026-11-06T21:05:00Z') === '12:05 AM');
  h.check('§7 a TIME reads 12-hour', formatClock('16:00:00') === '4:00 PM' && formatClock('12:30:00') === '12:30 PM' && formatClock('00:15') === '12:15 AM');
  h.check('§7 no time, nothing', formatClock(null) === '' && formatTime(null) === '' && formatDay('nonsense') === '');
  h.check('§7 a class span shares its PM', classTimes('16:00:00', '18:00:00') === '4:00 – 6:00 PM', classTimes('16:00:00', '18:00:00'));
  h.check('§7 a class span across noon names both', classTimes('11:00:00', '13:00:00') === '11:00 AM – 1:00 PM');
  h.check('§7 a class day', isClassDay('Sun, Mon, Tue', '2026-11-08') && !isClassDay('Sun, Mon, Tue', '2026-11-06') && isClassDay('Fri', '2026-11-06'));
  h.check('§7 no class days, no class day', !isClassDay(null, '2026-11-06') && !isClassDay('', '2026-11-06'));
  h.check('§7 starts in 25 min (12:35 UTC = 3:35 PM, class at 4)', startsLabel('16:00:00', '18:00:00', '2026-11-06T12:35:00Z') === 'Starts in 25 min');
  h.check('§7 on now during the class', startsLabel('16:00:00', '18:00:00', '2026-11-06T13:30:00Z') === 'On now');
  h.check('§7 nothing after it ends, or far ahead', startsLabel('16:00:00', '18:00:00', '2026-11-06T15:30:00Z') === '' && startsLabel('16:00:00', '18:00:00', '2026-11-06T05:00:00Z') === '');

  // §8 the greeting: the website's hours
  const home = strip(readAmsFile('client/src/pages/student/StudentHome.js'));
  h.check('§8 the web greets by noon and 5 PM', /if \(h < 12\) return "Good morning";\s*if \(h < 17\) return "Good afternoon";/.test(home));
  h.check('§8 11:59 Kuwait is morning, 12:00 afternoon', greeting('2026-11-06T08:59:00Z') === 'Good morning' && greeting('2026-11-06T09:00:00Z') === 'Good afternoon');
  h.check('§8 16:59 afternoon, 17:00 evening', greeting('2026-11-06T13:59:00Z') === 'Good afternoon' && greeting('2026-11-06T14:00:00Z') === 'Good evening');

  // §9 figures: KD to three decimals, the website's lesson progress
  h.check('§9 KD has three decimals', kd(90) === '90.000' && kd('66.6667') === '66.667' && kd(null) === '—' && kd('x') === '—');
  h.check('§9 the web rounds done ÷ total', /const pctOf = \(done, total\) => \(total \? Math\.round\(\(done \/ total\) \* 100\) : 0\);/.test(home));
  h.check('§9 the app does the same', lessonPct(23, 36) === 64 && lessonPct('1', '3') === 33 && lessonPct(5, 0) === 0 && lessonPct(null, null) === 0);
  h.check('§9 the distance line', distanceLine(42.4, 8, 'ICSA City') === '42 m from ICSA City · ±8 m' && distanceLine(null, null, 'ICSA City') === 'ICSA City' && distanceLine(null, null, null) === '');

  // §10 what is sent
  const none = checkInBody({ enrollmentId: 'e', fix: null, platform: 'ios' });
  h.check('§10 no position, no coordinates and no mocked flag', !('lat' in none) && !('lng' in none) && !('accuracy' in none) && !('mocked' in none));
  h.check('§10 the app is named', none.app_platform === 'ios');
  const real = checkInBody({ enrollmentId: 'e', fix: { lat: 1, lng: 2, accuracy: 5 }, platform: 'android' });
  h.check('§10 a fix with no mocked answer sends none', !('mocked' in real) && real.lat === 1 && real.lng === 2 && real.accuracy === 5);
  const notMocked = checkInBody({ enrollmentId: 'e', fix: { lat: 1, lng: 2, accuracy: 5, mocked: false }, platform: 'android' });
  h.check('§10 mocked: false is sent as false, not dropped', notMocked.mocked === false);
  h.check('§10 mocked: true is sent', checkInBody({ enrollmentId: 'e', fix: { lat: 1, lng: 2, accuracy: 5, mocked: true }, platform: 'ios' }).mocked === true);
  h.check('§10 the teacher only when chosen', !('selected_teacher_id' in none) && checkInBody({ enrollmentId: 'e', fix: null, teacherId: 't', platform: 'ios' }).selected_teacher_id === 't');

  // §12 the names the home card reads are the names my-context sends
  // (added 6 Nov 2026; the app shows nothing for them on an older AMS)
  h.check('§12 my-context sends class_days, start_time and end_time',
    /class_days: e\.days_of_week \|\| null,\s*start_time: e\.start_time \|\| null,\s*end_time: e\.end_time \|\| null,/.test(ctx));
  h.check('§12 …on both kinds of enrolment', (ctx.match(/\.\.\.classTimes\(e\),/g) ?? []).length === 2);
  h.check('§12 today’s check-in sends its distance and accuracy', /ar\.check_in_distance_m, ar\.check_in_accuracy_m/.test(ctx));

  // §11 the map
  const city = { id: 'c', name: 'ICSA City', latitude: 29.37, longitude: 47.98, radius_m: 150, is_mine: false };
  const mah = { id: 'm', name: 'ICSA Mahboula', latitude: 29.14, longitude: 48.12, radius_m: 200, is_mine: true };
  const r = regionFor([{ lat: city.latitude, lng: city.longitude, radiusM: 150 }, { lat: 29.371, lng: 47.981 }]);
  h.check('§11 a region exists', r !== null);
  const inside = (lat: number, lng: number) => !!r && Math.abs(lat - r.latitude) <= r.latitudeDelta / 2 && Math.abs(lng - r.longitude) <= r.longitudeDelta / 2;
  h.check('§11 it shows the circle edge and the student', inside(29.37 + 150 / 111_320, 47.98) && inside(29.371, 47.981));
  h.check('§11 no points, no region', regionFor([]) === null && regionFor([{ lat: NaN, lng: 1 }]) === null);
  h.check('§11 the map opens on the attended branch first', mapBranch([city, mah], 'c')?.id === 'c');
  h.check('§11 else the student’s own', mapBranch([city, mah], null)?.id === 'm');
  h.check('§11 else the first, else none', mapBranch([city], null)?.id === 'c' && mapBranch([], null) === null && mapBranch(undefined, null) === null);
});
