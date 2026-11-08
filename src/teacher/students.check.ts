import { readAmsFile } from '../../scripts/ams.ts';
import { runAsync } from '../../scripts/check-harness.ts';

import { STATUS_TONE, STUDENTS_API, attendanceLine, coursesLine, dialable, listPath, searchParam, waNumber, whatsappUrl } from './students.ts';

// The teacher's Students tab (8 Nov 2026) against the AMS: a teacher may call
// every endpoint, the list is scoped by the AMS to the students he teaches,
// the status words are computeStudentStatus's, the attendance counts are
// getStudentAttendance's, and the WhatsApp number is the AMS's own waNumber —
// run side by side on a table of numbers, not compared by eye.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';

runAsync('students.check — the teacher\'s Students agree with the AMS', async (h) => {
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
});
