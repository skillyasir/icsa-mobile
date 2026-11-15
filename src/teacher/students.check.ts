import { readAmsFile } from '../../scripts/ams.ts';
import { runAsync } from '../../scripts/check-harness.ts';
import { strip } from '../../scripts/strip.ts';

import { existsSync, readFileSync } from 'node:fs';

import { STATUS_TONE, STUDENTS_API, STUDENTS_HOME, STUDENT_PROFILE, TEACHER_FOLLOWUPS, attendanceLine, coursesLine, dialable, followupsDue, followupsRowLine, listPath, owesAny, payParams, searchParam, waNumber, whatsappUrl } from './students.ts';

// The teacher's Students tab (8 Nov 2026) against the AMS: a teacher may call
// every endpoint, the list is scoped by the AMS to the students he teaches,
// the status words are computeStudentStatus's, the attendance counts are
// getStudentAttendance's, and the WhatsApp number is the AMS's own waNumber —
// run side by side on a table of numbers, not compared by eye.

const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';

runAsync('students.check — the teacher\'s and reception\'s Students agree with the AMS', async (h) => {
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');

  // §1 routed, and a teacher may call each
  const routes = strip(readAmsFile('server/src/routes/students.js'));
  h.check('§1 the students routes were read', routes.length > 1500);
  h.check('§1 the list: a teacher may call it', /router\.get\('\/', auth, authorize\([^)]*'teacher'[^)]*\), ctrl\.getAllStudents\);/.test(routes) && STUDENTS_API.list.path === '/students');
  h.check('§1 one student: a teacher may call it', /router\.get\('\/:id', auth, authorize\([^)]*'teacher'[^)]*\), ctrl\.getStudentById\);/.test(routes) && STUDENTS_API.one.path === '/students/:id');
  h.check('§1 attendance: a teacher may call it', /router\.get\('\/:id\/attendance', auth, authorize\([^)]*'teacher'[^)]*\), ctrl\.getStudentAttendance\);/.test(routes) && STUDENTS_API.attendance.path === '/students/:id/attendance');

  // §2 the AMS scopes the list, and computes the status
  const ctl = strip(readAmsFile('server/src/controllers/studentsController.js'));
  const list = body(ctl, 'getAllStudents');
  h.check('§2 getAllStudents extracts (floor)', list.length > 3000, String(list.length));
  h.check('§2 a teacher gets only the students he teaches, search or not', /if \(role === 'teacher' && !isAcademicSupervisor\(req\.user\)\) \{\s*conditions\.push\(teacherStudentScopeSql\(\{/.test(list));
  h.check('§2 the search is the `search` parameter', /const \{ branch_id, search, course_id, teacher_id, date_from, date_to \} = req\.query;/.test(list) && listPath('Ali B') === '/students?search=Ali%20B' && listPath(null) === '/students');
  h.check('§2 a search from 2 characters', searchParam(' a ') === null && searchParam(' ab ') === 'ab');
  h.check('§2 every row carries the AMS\'s status', /status: computeStudentStatus\(r, thr\)/.test(list) && /res\.json\(\{ count: filtered\.length, students: filtered \}\);/.test(list));
  const statusFn = /function computeStudentStatus\(row, thr\) \{[\s\S]*?\n\}/.exec(ctl)?.[0] ?? '';
  const words = [...statusFn.matchAll(/return "([^"]+)";/g)].map((m) => m[1]);
  const onBreak = /const ON_BREAK_STATUS = '([^']+)';/.exec(ctl)?.[1];
  h.check('§2 computeStudentStatus\'s words were read (floor 4)', words.length >= 4 && !!onBreak, words.join());
  h.check('§2 each of its words has a tone here, and nothing else does', JSON.stringify([...new Set([...words, onBreak])].sort()) === JSON.stringify(Object.keys(STATUS_TONE).sort()), Object.keys(STATUS_TONE).join());
  const base = /const STUDENT_SELECT_BASE = `([\s\S]*?)`;/.exec(ctl)?.[1] ?? '';
  h.check('§2 the row carries full_name, phone, student_code (s.*), last_present, branch_name, enrollments', base.length > 800 && /SELECT s\.\*,/.test(base) && /AS last_present/.test(base) && /u\.full_name, u\.email, u\.phone,/.test(base) && /b\.name AS branch_name/.test(base) && /\) AS enrollments/.test(base));
  h.check('§2 …each enrolment: course_name, teacher_name, status, enrollment_no', /SELECT e\.id, e\.enrollment_no, e\.status, e\.course_id, e\.enrolled_date::text AS enrolled_date,/.test(base) && /c\.name AS course_name,/.test(base) && /tu\.full_name AS teacher_name/.test(base));
  h.check('§2 courses line: active first, each course once', coursesLine([
    { id: '1', enrollment_no: null, status: 'completed', course_id: 'a', course_name: 'Word', teacher_name: null, enrolled_date: null },
    { id: '2', enrollment_no: null, status: 'active', course_id: 'b', course_name: 'Excel', teacher_name: null, enrolled_date: null },
    { id: '3', enrollment_no: null, status: 'active', course_id: 'b', course_name: 'Excel', teacher_name: null, enrolled_date: null },
  ]) === 'Excel · Word');

  // §3 the AMS's attendance counts
  const att = body(ctl, 'getStudentAttendance');
  h.check('§3 getStudentAttendance extracts (floor)', att.length > 1200, String(att.length));
  h.check('§3 it answers the rate, the six counts and the records', /attendance_rate,\s*total_classes: records\.length,\s*present, absent, late, excused,\s*pending, pending_review: pendingReview,\s*records,/.test(att));
  h.check('§3 the counts line names only what is not zero', attendanceLine({ present: 10, absent: 0, late: 1, excused: 0, pending: 0, pending_review: 2 }) === 'Present 10 · Late 1 · Awaiting review 2');

  // §4 the phone and WhatsApp
  h.check('§4 dialable keeps a leading + and digits', dialable(' +965 5042-0435 ') === '+96550420435' && dialable('123') === null && dialable(null) === null);
  const src = readAmsFile('client/src/lib/waLink.js');
  h.check('§4 the AMS\'s waLink.js has no imports (so it can be run here as it is)', src.length > 1000 && !/^\s*import\s/m.test(src));
  const ams = (await import('data:text/javascript,' + encodeURIComponent(src))) as { waNumber: (p: string | null) => string | null };
  h.check('§4 the AMS\'s waNumber was loaded', typeof ams.waNumber === 'function');
  const table = ['50420435', '+965 5042 0435', '60000000', '90000000', '40000000', '0917 123 4567', '+63 917 123 4567', '5042043', '', '   ', 'abc', '00965 50420435', '96550420435'];
  const differ = table.filter((p) => waNumber(p) !== ams.waNumber(p));
  h.check(`§4 waNumber agrees with the AMS on all ${table.length} numbers`, differ.length === 0, differ.join(' | '));
  h.check('§4 a bare Kuwaiti mobile gets 965; a foreign local is never guessed', whatsappUrl('50420435') === 'https://wa.me/96550420435' && whatsappUrl('0917 123 4567') === 'https://wa.me/09171234567' && whatsappUrl(null) === null);

  // §5 reception's Students (13 Nov 2026): the same screens, any branch, with the fees
  const payRoutes = strip(readAmsFile('server/src/routes/payments.js'));
  h.check('§5 the fee summary is routed, and reception (supervisor) may read it', /router\.get\('\/student\/:student_id\/summary', auth, authorize\([^)]*'supervisor'[^)]*\), getStudentPaymentSummary\)/.test(payRoutes));
  const ctlP = strip(readAmsFile('server/src/controllers/paymentsController.js'));
  h.check('§5 it answers the per-enrolment net, paid and balance this screen reads', /enrollment_no: enr\.enrollment_no/.test(ctlP) && /net_amount: enrNetAmount\.toFixed\(3\)/.test(ctlP) && /total_paid: enrTotalPaid\.toFixed\(3\)/.test(ctlP) && /balance: enrBalance\.toFixed\(3\)/.test(ctlP) && /total_paid_overall:/.test(ctlP) && /balance_overall:/.test(ctlP));
  const appDir = new URL('../app/', import.meta.url).pathname;
  h.check('§5 each view’s Students and profile route exist', (['teacher', 'reception'] as const).every((w) => existsSync(appDir + STUDENTS_HOME[w].slice(1) + '/index.tsx') && existsSync(appDir + STUDENT_PROFILE[w].slice(1) + '.tsx')));
  const listSrc = readFileSync(new URL('./StudentsScreen.tsx', import.meta.url), 'utf8');
  h.check('§5 reception lists nobody until it searches (every branch would come back)', /live && \(!reception \|\| !!search\)/.test(listSrc));
  const oneSrc = readFileSync(new URL('./StudentScreen.tsx', import.meta.url), 'utf8');
  h.check('§5 only reception asks for the fees', /STUDENTS_API\.fees\.path[^;]*live && reception\)/.test(oneSrc));

  // §6 reception's profile buttons (deferred 14 Nov 2026; built 15 Nov 2026)
  const one = strip(oneSrc);
  h.check('§6 the buttons are reception’s own profile only (a manager’s has no way back into reception’s screens)', /const desk = who === 'reception';/.test(one) && /\{desk && id && fees\.data \? \(/.test(one));
  h.check('§6 Take payment only when something is owed; Enrol always', /\{owesAny\(fees\.data\) \? \(/.test(one) && /<Button title="Take payment" onPress=\{\(\) => router\.push\(\{ pathname: '\/take-payment', params: payParams\(id, /.test(one) && /<Button title="Enrol" variant="outline" onPress=\{\(\) => router\.push\(\{ pathname: '\/enrol', params: \{ studentId: id \} \}\)\}/.test(one));
  const fee = (bal: string, lines: [string, string][]) => ({ balance_overall: bal, total_paid_overall: '0', enrollments: lines.map(([enrollment_id, balance]) => ({ enrollment_id, enrollment_no: null, course_name: null, status: null, net_amount: '0', total_paid: '0', balance })) });
  h.check('§6 owes reads the AMS’s balance as the Owes pill does (half a fils is nothing)', owesAny(fee('12.500', [])) && !owesAny(fee('0.000', [])) && !owesAny(fee('0.0004', [])) && !owesAny(null) && /Number\(fees\.data\.balance_overall\) > 0\.0005 \? 'Owes'/.test(one));
  h.check('§6 Take payment opens on the enrolment when exactly one owes, else on the student', JSON.stringify(payParams('s1', fee('30', [['e1', '0.000'], ['e2', '30.000']]))) === '{"studentId":"s1","enrollmentId":"e2"}' && JSON.stringify(payParams('s1', fee('60', [['e1', '30.000'], ['e2', '30.000']]))) === '{"studentId":"s1"}' && JSON.stringify(payParams('s1', fee('0', []))) === '{"studentId":"s1"}');
  const tp = strip(readFileSync(new URL('../reception/TakePaymentScreen.tsx', import.meta.url), 'utf8'));
  const en = strip(readFileSync(new URL('../reception/EnrolScreen.tsx', import.meta.url), 'utf8'));
  // §7 a teacher's follow-ups (15 Nov 2026 — in the scope since 3 Nov 2026, missed when Teachers was built; found by Yasir)
  const fuRoutes = strip(readAmsFile('server/src/routes/followups.js'));
  const fuCtl = strip(readAmsFile('server/src/controllers/followupsController.js'));
  const fuSvc = strip(readAmsFile('server/src/services/followupCases.js'));
  h.check('§7 anyone signed in reads their own list and logs on a case (the controller decides which)', /router\.get\('\/mine', auth, c\.getMine\)/.test(fuRoutes) && /router\.post\('\/cases\/:id\/log', auth, c\.logCase\)/.test(fuRoutes));
  h.check('§7 an attendance case is opened owned by the student’s teacher', /SELECT COALESCE\(e\.assigned_teacher_id, cs\.teacher_id\) AS teacher_id/.test(fuSvc) && /own\.teacher_id AS owner_id/.test(fuSvc));
  h.check('§7 his list holds the cases he owns and the fee cases of the students he teaches', /const vis = `\(fc\.owner_id = \$1/.test(fuCtl) && /teacherStudentScopeSql\(\{ studentCol: 's\.id', teacherParam: '\$1'/.test(fuCtl));
  h.check('§7 he may log on a fee case of his student (canAccess), as the AMS words it', /if \(c\.kind === 'payment'\) \{\s*return c\.owner_id === req\.user\.id \|\| isDesk\(req\) \|\| await canAccess\(req\.user, c\.student_id\)/.test(fuCtl) && fuCtl.includes('logged by the payment desk, the teacher, or the staff member who enrolled the student'));
  h.check('§7 due is overdue and today — reception’s own reading', followupsDue({ overdue: 2, today: 3 }) === 5 && followupsDue({ overdue: 0, today: 0 }) === 0 && followupsDue(null) === 0 && /const due = f\.overdue \+ f\.today;/.test(strip(readFileSync(new URL('../reception/rules.ts', import.meta.url), 'utf8'))));
  h.check('§7 the row’s words', followupsRowLine(3) === '3 due' && followupsRowLine(0) === 'Nothing due');
  const fuRoute = readFileSync(new URL('../app/teacher-followups.tsx', import.meta.url), 'utf8');
  h.check('§7 his route is the approved Follow-ups screen, its way back his Today', TEACHER_FOLLOWUPS === '/teacher-followups' && /return <FollowupsScreen back="\/teacher" \/>;/.test(fuRoute) && /export function FollowupsScreen\(\{ back, backLabel = '‹ Back' \}: \{ back\?: Href; backLabel\?: string \}\)/.test(strip(readFileSync(new URL('../reception/FollowupsScreen.tsx', import.meta.url), 'utf8'))));
  const today = strip(readFileSync(new URL('./TodayScreen.tsx', import.meta.url), 'utf8'));
  h.check('§7 Today: a card only when some are due, opening his follow-ups; pull-to-refresh asks again', /const followups = useAmsGet<MineAnswer>\(minePath\(null, 5\), live\);/.test(today) && /\{due > 0 \? \(/.test(today) && /router\.push\(TEACHER_FOLLOWUPS\)/.test(today) && /followups\.refresh\(\);/.test(today));
  const listStripped = strip(listSrc);
  h.check('§7 Students: the row is the teacher’s only (reception has its own tab), always there, opening his follow-ups', /useAmsGet<MineAnswer>\(minePath\(null, 5\), live && !reception\)/.test(listStripped) && /\{!reception && live \? \(/.test(listStripped) && /router\.push\(TEACHER_FOLLOWUPS\)/.test(listStripped));

  h.check('§6 both screens open with what the buttons send', /useLocalSearchParams<\{ studentId\?: string; enrollmentId\?: string \}>\(\)/.test(tp) && /useState<string \| null>\(params\.studentId \?\? null\)/.test(tp) && /useState<string \| null>\(params\.enrollmentId \?\? null\)/.test(tp) && /useLocalSearchParams<\{ studentId\?: string \}>\(\)/.test(en) && /useState<string \| null>\(params\.studentId \?\? null\)/.test(en));
});
