import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  SETTABLE,
  TEACHER_API,
  checkedIn,
  confirmAllBody,
  confirmAllIds,
  doneList,
  initials,
  minutesLate,
  pathFor,
  pendingRank,
  presentBody,
  rosterCounts,
  rowMarkable,
  sessionChanges,
  setDraft,
  stuckStudents,
  waitingList,
  walkInLine,
  type RosterRow,
  type StaffContext,
  type WalkIn,
} from './today.ts';

// The teacher's Today and Mark class (Phase 2 piece 2, 7 Nov 2026) against the
// AMS: the endpoints, who may call them, the fields they read, the statuses
// they accept, and the website's own teacher card for order and wording.
// Reads the AMS copy beside this repo; missing is COULD NOT RUN.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';
const words = (s: string) => [...s.matchAll(/['"]([a-z_]+)['"]/g)].map((m) => m[1]);

const walk = (over: Partial<WalkIn> = {}): WalkIn => ({
  attendance_id: 'a', enrollment_id: 'e', enrollment_no: 'EN-1', student_id: 's', student_name: 'Maria Santos',
  student_code: 'STU-1', course_name: 'Computer Secretarial', status: 'pending', check_in_time: '2026-11-07T12:41:00Z',
  check_in_distance_m: 42, notes: null, attendance_mode: 'classroom', attended_branch_name: 'ICSA City', teacher_name: 'T',
  ...over,
});
const row = (over: Partial<RosterRow> = {}): RosterRow => ({
  enrollment_id: 'e1', student_id: 's1', student_code: null, student_name: 'A', attendance_id: 'a1', status: 'pending',
  check_in_time: '2026-11-07T12:41:00Z', check_in_distance_m: 42, notes: null, attendance_mode: 'classroom', attended_branch_name: null,
  ...over,
});
const fmt = (v: string | null) => (v ? '3:41 PM' : '');

run('teacher/today.check — Today and Mark class agree with the AMS', (h) => {
  // §0 the extractors
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');
  h.check('§0 body() finds nothing for a missing name', body('const a = async () => {\n};', 'zz') === '');
  h.check('§0 words() reads quoted words in order', words(`["a", 'b_c']`).join() === 'a,b_c');

  // §1 every endpoint is routed and open to a teacher
  const att = strip(readAmsFile('server/src/routes/attendance.js'));
  const asg = strip(readAmsFile('server/src/routes/assignments.js'));
  const prg = strip(readAmsFile('server/src/routes/progress.js'));
  h.check('§1 the AMS routes were read', att.length > 1000 && asg.length > 300 && prg.length > 200);
  const routed = (src: string, verb: string, sub: string) =>
    new RegExp(`router\\.${verb}\\('${sub.replace(/[/:]/g, (c) => '\\' + c)}',\\s*auth,\\s*(authorize\\(([^)]*)\\)|assignmentReaders)`).exec(src);
  const teacherMay = (m: RegExpExecArray | null, src: string) =>
    !!m && (m[2] !== undefined ? words(m[2]).includes('teacher') : /const assignmentReaders = authorize\([^)]*'teacher'/.test(src));
  const eps = Object.values(TEACHER_API);
  h.check('§1 six endpoints (floor)', eps.length === 6);
  for (const e of eps) {
    const [, mount, sub] = /^\/(attendance|assignments|progress)(\/.*)$/.exec(e.path) ?? [];
    const src = mount === 'attendance' ? att : mount === 'assignments' ? asg : prg;
    const m = routed(src, e.method.toLowerCase(), sub ?? '');
    h.check(`§1 ${e.method} ${e.path} is routed and a teacher may call it`, teacherMay(m, src));
  }
  h.check('§1 a path parameter is filled and escaped', pathFor(TEACHER_API.confirmSession.path, { session_id: 'a/b' }) === '/attendance/sessions/a%2Fb/confirm');

  // §2 the fields and statuses the AMS reads
  const ctl = strip(readAmsFile('server/src/controllers/attendanceController.js'));
  const ctx = body(ctl, 'getStaffContext');
  const ses = body(ctl, 'confirmSession');
  const ind = body(ctl, 'confirmIndividual');
  const all = body(ctl, 'confirmPresentBulk');
  h.check('§2 the four handlers extract (floor)', ctx.length > 4000 && ses.length > 2000 && ind.length > 2000 && all.length > 1500,
    [ctx.length, ses.length, ind.length, all.length].join(','));
  const valid = words(/const VALID_STATUSES = \[([^\]]*)\]/.exec(ctl)?.[1] ?? '');
  h.check('§2 every mark the app offers is one the AMS accepts', SETTABLE.every((s) => valid.includes(s)), valid.join());
  h.check('§2 Mark class sends { changes: [{ enrollment_id, status }] }', /Array\.isArray\(req\.body\.changes\)/.test(ses)
    && /const \{ enrollment_id, status, notes \} = change;/.test(ses)
    && JSON.stringify(sessionChanges({ e1: 'late' })) === '{"changes":[{"enrollment_id":"e1","status":"late"}]}');
  h.check('§2 Present sends attendance_id and status', /const \{ attendance_id, status, notes, session_teacher_id \} = req\.body;/.test(ind)
    && JSON.stringify(presentBody(walk())) === '{"attendance_id":"a","status":"present"}');
  h.check('§2 Confirm all sends attendance_ids', /req\.body\.attendance_ids/.test(all) && JSON.stringify(confirmAllBody(['x'])) === '{"attendance_ids":["x"]}');
  h.check('§2 the AMS confirms only plain pending in a Confirm all', /if \(ar\.status !== 'pending'\)/.test(all));
  h.check('§2 …so the app sends only plain pending', confirmAllIds([walk({ attendance_id: '1' }), walk({ attendance_id: '2', status: 'pending_review' })]).join() === '1');
  const bulkMax = Number(/const BULK_MAX = (\d+);/.exec(ctl)?.[1]);
  h.check('§2 the AMS takes up to 200 at once (a branch day is far below it)', bulkMax === 200, String(bulkMax));

  // §3 what a teacher may not mark — the app keeps the controls off it
  h.check('§3 the AMS refuses a teacher on pending_review (both paths)',
    /existing\.status === 'pending_review' && staffRole\(req\.user\) === 'teacher'/.test(ses)
    && /ar\.status === 'pending_review' && staffRole\(req\.user\) === 'teacher'/.test(ind));
  h.check('§3 …and the app does not offer it', !rowMarkable(row({ status: 'pending_review' }), false));
  h.check('§3 the AMS skips a student with no record', /if \(existRes\.rows\.length === 0\) \{[\s\S]{0,120}skipped\+\+;/.test(ses));
  h.check('§3 …and the app does not offer one', !rowMarkable(row({ attendance_id: null, status: null }), false));
  h.check('§3 the AMS sends read_only for a teacher on another day', /read_only: readOnly/.test(ctx) && /const readOnly = isTeacher &&/.test(ctx));
  h.check('§3 …and the app offers nothing then', !rowMarkable(row(), true));
  h.check('§3 a plain check-in is markable today', rowMarkable(row(), false) && rowMarkable(row({ status: 'present' }), false));

  // §4 the website's teacher card: order, marks, initials, the draft rule
  const web = strip(readAmsFile('client/src/pages/dashboard/widgets/TeacherAttendanceCard.js'));
  h.check('§4 the web card was read', web.length > 4000, String(web.length));
  h.check('§4 the web ranks online pending first, then pending, then review',
    /r\.status === "pending" \? \(r\.attendance_mode === "online" \? 0 : 1\) : r\.status === "pending_review" \? 2 : 3/.test(web));
  h.check('§4 the app ranks the same', pendingRank({ status: 'pending', attendance_mode: 'online' }) === 0
    && pendingRank({ status: 'pending', attendance_mode: 'classroom' }) === 1 && pendingRank({ status: 'pending_review', attendance_mode: null }) === 2
    && pendingRank({ status: 'present', attendance_mode: null }) === 3);
  const webSettable = words(/const SETTABLE = \[([^\]]*)\];/.exec(web)?.[1] ?? '');
  h.check('§4 the four marks are the website\'s, in its order', JSON.stringify(webSettable) === JSON.stringify([...SETTABLE]), webSettable.join());
  h.check('§4 the web takes a draft back when the row\'s own status is chosen', /if \(row && status === row\.status\) delete next\[enrollmentId\];/.test(web));
  const d1 = setDraft({}, row({ status: 'pending' }), 'late');
  h.check('§4 choosing a mark drafts it', d1.e1 === 'late');
  h.check('§4 choosing the row\'s own status takes it back', !('e1' in setDraft(d1, row({ status: 'late' }), 'late')));
  h.check('§4 initials as the website', initials('Maria Santos') === 'MS' && initials('Ahmed Al-Rashid Khan') === 'AA' && initials('') === '?' && initials(null) === '?');
  h.check('§4 the web confirms a walk-in Present only', /onConfirm\(rec, "present", \(\) => \{\}\)/.test(web));

  // §5 Waiting for you
  const sc = (list: WalkIn[]): StaffContext => ({ date: '', today: '', role: 'teacher', scope: 'mine', can_scope: false, read_only: false, sessions: [], individual_pending: list });
  const w = waitingList(sc([
    walk({ attendance_id: 'p1' }), walk({ attendance_id: 'ok', status: 'present' }),
    walk({ attendance_id: 'rv', status: 'pending_review' }), walk({ attendance_id: 'on', attendance_mode: 'online' }),
    walk({ attendance_id: 'p2' }),
  ]));
  h.check('§5 waiting: four, done ones left out (cardinality floor)', w.length === 4, w.map((x) => x.attendance_id).join());
  h.check('§5 online first, pending in the AMS\'s order, review last', w.map((x) => x.attendance_id).join() === 'on,p1,p2,rv');
  h.check('§5 done today: the marked ones', doneList(sc([walk({ status: 'present' }), walk()])).length === 1);
  h.check('§5 nothing from nothing', waitingList(null).length === 0 && doneList(undefined).length === 0);
  h.check('§5 a walk-in line', walkInLine(walk(), fmt) === '3:41 PM · 42 m · Computer Secretarial', walkInLine(walk(), fmt));
  h.check('§5 an online one says so, no distance', walkInLine(walk({ attendance_mode: 'online', check_in_distance_m: 900 }), fmt) === 'in class since 3:41 PM · Online · Computer Secretarial');
  h.check('§5 the web words online the same', /" \\u00b7 in class since "/.test(web));

  // §6 Mark class figures
  const roster = [row({ enrollment_id: 'a', status: 'present' }), row({ enrollment_id: 'b', status: 'pending' }),
    row({ enrollment_id: 'c', attendance_id: null, status: null }), row({ enrollment_id: 'd', status: 'pending_review' })];
  const c0 = rosterCounts(roster, {});
  h.check('§6 counts as marked', c0.present === 1 && c0.waiting === 2 && c0.none === 1 && c0.late === 0, JSON.stringify(c0));
  const c1 = rosterCounts(roster, { b: 'late' });
  h.check('§6 counts with this screen\'s changes', c1.late === 1 && c1.waiting === 1, JSON.stringify(c1));
  h.check('§6 checked in = has a record', checkedIn(roster) === 3);
  h.check('§6 18 min late (4:18 PM Kuwait for a 4 PM class)', minutesLate('16:00:00', '2026-11-07T13:18:00Z') === 18);
  h.check('§6 early or on time is not late', minutesLate('16:00:00', '2026-11-07T12:55:00Z') === 0 && minutesLate('16:00:00', '2026-11-07T13:00:00Z') === 0);
  h.check('§6 no time, no hint', minutesLate(null, '2026-11-07T13:18:00Z') === 0 && minutesLate('16:00', null) === 0);

  // §7 the tiles read the AMS's own figures
  const queue = strip(readAmsFile('server/src/controllers/assignmentsController.js'));
  h.check('§7 the review queue answers total_pending', /total_pending: total,/.test(queue));
  const prog = strip(readAmsFile('server/src/services/progressService.js'));
  h.check('§7 my-classes answers needs.stuck with a student_id each', /needs: \{ stuck, /.test(prog) && /const who = \{ student_id: st\.student_id,/.test(prog));
  h.check('§7 a student stuck in two subjects counts once', stuckStudents({ needs: { stuck: [{ student_id: 'x' }, { student_id: 'x' }, { student_id: 'y' }] } }) === 2);
  h.check('§7 nothing from nothing', stuckStudents(null) === 0 && stuckStudents({}) === 0);
});
