import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import { formatDay } from '../attendance/rules.ts';
import {
  LEARN_API,
  SUBMISSION_STATUS,
  chaptersOf,
  countsLine,
  countsOf,
  courseSummary,
  daysLeftLine,
  initialOf,
  lineOf,
  subjectChip,
  type Item,
} from './learn.ts';

// The student's Learn tab (8 Nov 2026) against the AMS: every endpoint is
// routed and open to a student, every field the screens read is one the
// controller sends, and the words and counts are the website's own subject
// page (client/src/pages/student/StudentSubjectLessons.js).

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';

/** The AMS firewall's own matcher: an exact path, or a prefix that ends in '*'. */
function firewallAdmits(fw: string, method: string, path: string): boolean {
  const entries = [...fw.matchAll(/\{\s*method:\s*'([A-Z]+)',\s*path:\s*'([^']+)'\s*\}/g)].map((m) => ({ method: m[1], path: m[2] }));
  return entries.some((e) => e.method === method && (e.path.endsWith('*') ? path.startsWith(e.path.slice(0, -1)) : e.path === path));
}
const concrete = (p: string) => '/api' + p.replace(/:[A-Za-z_]\w*/g, '0b1c');

const item = (over: Partial<Item>): Item => ({
  item_type: 'lesson',
  id: 'i',
  title: 'T',
  kind: 'lesson',
  lesson_type: null,
  duration_minutes: null,
  completed_at: null,
  assignment_status: null,
  assignment_grade: null,
  quiz_attempts_used: null,
  quiz_best_percent: null,
  quiz_passed: null,
  quiz_max_attempts: null,
  ...over,
});

run('learn.check — the student Learn tab agrees with the AMS', (h) => {
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');
  h.check('§0 the firewall matcher: a prefix admits, an exact entry does not', firewallAdmits("{ method: 'GET', path: '/api/a/*' } { method: 'GET', path: '/api/b' }", 'GET', '/api/a/1/x') && !firewallAdmits("{ method: 'GET', path: '/api/b' }", 'GET', '/api/b/1') && !firewallAdmits("{ method: 'GET', path: '/api/a/*' }", 'POST', '/api/a/1'));

  // §1 routed, and open to a student
  const fw = strip(readAmsFile('server/src/middleware/studentFirewall.js'));
  const authR = strip(readAmsFile('server/src/routes/auth.js'));
  h.check('§1 the AMS files were read', fw.length > 1500 && authR.length > 1000);
  const eps = Object.entries(LEARN_API);
  h.check('§1 five endpoints (floor)', eps.length === 5);
  for (const [, e] of eps) {
    h.check(`§1 ${e.method} /api${e.path} is in the student firewall`, firewallAdmits(fw, e.method, concrete(e.path)));
    const route = e.path.replace(/^\/auth/, '');
    h.check(`§1 ${e.method} ${route} is routed`, new RegExp(`router\\.${e.method.toLowerCase()}\\('${route.replace(/\//g, '\\/')}',\\s+auth,`).test(authR));
  }

  // §2 the fields the screens read are the ones the controllers send
  const lc = strip(readAmsFile('server/src/controllers/lessonsController.js'));
  const courses = body(lc, 'getMyCourses');
  const subjects = body(lc, 'getMySubjects');
  const items = body(lc, 'getMySubjectLessons');
  h.check('§2 the three controllers extract (floor)', courses.length > 600 && subjects.length > 1000 && items.length > 3000, `${courses.length}/${subjects.length}/${items.length}`);
  h.check('§2 courses: id, name, subject_count, frozen', /SELECT DISTINCT c\.id, c\.name,/.test(courses) && /AS subject_count/.test(courses) && /AS frozen/.test(courses) && /res\.json\(\{ courses: r\.rows \}\)/.test(courses));
  for (const f of ['frozen', 'expires_at', 'days_left', 'lesson_count']) h.check(`§2 subjects send ${f}`, new RegExp(`AS ${f}\\b`).test(subjects));
  h.check('§2 subjects send id, name, description, image_url, color', /SELECT s\.id, s\.name, s\.description, s\.image_url, s\.color,/.test(subjects) && /res\.json\(\{ subjects: r\.rows \}\)/.test(subjects));
  for (const f of ['assignment_status', 'assignment_grade', 'quiz_attempts_used', 'quiz_best_percent', 'quiz_passed', 'quiz_max_attempts']) {
    h.check(`§2 the subject list sends ${f}`, new RegExp(`AS ${f}\\b`).test(items));
  }
  h.check('§2 …and completed_at, lesson_type, duration_minutes', /lc\.completed_at/.test(items) && /l\.lesson_type, l\.duration_minutes/.test(items));
  h.check('§2 …and the final exam as { locked, missing }', /final_exam: \{ locked: fe\.locked, missing: fe\.missing \}/.test(items));
  h.check('§2 …and the answer is { subject, lessons, resume_lesson_id, progress }', /subject: acc\.rows\[0\],/.test(items) && /lessons: items,/.test(items) && /resume_lesson_id: resumeLessonId,/.test(items) && /progress: \{ completed: completedCount, total: realLessons\.length \}/.test(items));
  h.check('§2 …the subject names its course', /SELECT s\.name AS subject_name, c\.name AS course_name, c\.id AS course_id/.test(items));
  const li = strip(readAmsFile('server/src/services/lessonInteractive.js'));
  h.check('§2 an interactive lesson sends basis, taken, quiz_right, quiz_total, pct', /basis: p\.basis,[^}]*taken: p\.taken, quiz_right: p\.quiz_right, quiz_total: p\.quiz_total,[^}]*pct: p\.pct,/.test(li) && /interactive: \{ \.\.\.LI\.progressFields\(p\), quiz_passed: p\.quiz_passed, started: li_steps_done != null \}/.test(items));
  const sa = strip(readAmsFile('server/src/controllers/studentAcademicController.js'));
  h.check('§2 progress: state, completion_percent, items_done, items_total, per enrolment with course_id', /state: p\.state,/.test(sa) && /completion_percent: p\.progress,/.test(sa) && /items_done: p\.items_done,/.test(sa) && /items_total: p\.items_total,/.test(sa) && /course_id: e\.course_id,/.test(sa));
  h.check('§2 grades: state, score_percent, letter', /state: gradeStateOf\(g, pState\),/.test(sa) && /score_percent: g\.course_score,/.test(sa) && /letter: g\.letter,/.test(sa));

  // §3 the website's words and counts
  const web = strip(readAmsFile('client/src/pages/student/StudentSubjectLessons.js'));
  h.check('§3 the website\'s subject page was read', web.length > 8000, String(web.length));
  for (const [k, v] of Object.entries(SUBMISSION_STATUS)) {
    h.check(`§3 "${v.text}" is the website's word for ${k}`, new RegExp(`${k}: \\{ label: "${v.text}"`).test(web));
  }
  h.check('§3 the done counts are the website\'s: lesson completed_at, assignment any status, quiz any attempt',
    /if \(it\.item_type === "lesson"\) return !!it\.completed_at;/.test(web) && /if \(it\.item_type === "assignment"\) return !!it\.assignment_status;/.test(web) && /if \(it\.item_type === "quiz"\) return \(it\.quiz_attempts_used \|\| 0\) > 0;/.test(web));
  const its = [
    item({ id: 'l1', completed_at: '2026-11-01' }),
    item({ id: 'l2' }),
    item({ id: 'q1', item_type: 'quiz', kind: 'quiz', quiz_attempts_used: 2 }),
    item({ id: 'q2', item_type: 'quiz', kind: 'quiz', quiz_attempts_used: 0 }),
    item({ id: 'a1', item_type: 'assignment', kind: 'assignment', assignment_status: 'needs_revision' }),
    item({ id: 'a2', item_type: 'assignment', kind: 'assignment' }),
    item({ id: 'a3', item_type: 'assignment', kind: 'assignment' }),
  ];
  const c = countsOf(its);
  h.check('§3 counts: lessons 1/2, quizzes 1/2, assignments 1/3', c.lessons.done === 1 && c.lessons.total === 2 && c.quizzes.taken === 1 && c.quizzes.total === 2 && c.assignments.handedIn === 1 && c.assignments.total === 3);
  h.check('§3 the counts line', countsLine(c) === 'Lessons 1/2 · quizzes 1/2 · assignments 1/3', countsLine(c));
  h.check('§3 a type the subject lacks is left out', countsLine(countsOf([item({ completed_at: 'x' })])) === 'Lessons 1/1');

  // The final exam, a quiz and an interactive lesson — in the website's words.
  const fx = lineOf(item({ item_type: 'quiz', kind: 'quiz', final_exam: { locked: true, missing: [1, 2] }, quiz_attempts_used: 0 }), formatDay);
  h.check('§3 a locked final exam: "opens when you finish 2 more items"', fx.kind === 'final' && fx.sub === 'Final exam · opens when you finish 2 more items' && /opens when you finish " \+ fx\.missing\.length \+ " more item"/.test(web), fx.sub);
  h.check('§3 …one more item', lineOf(item({ item_type: 'quiz', kind: 'quiz', final_exam: { locked: true, missing: [1] } }), formatDay).sub === 'Final exam · opens when you finish 1 more item');
  const q = lineOf(item({ item_type: 'quiz', kind: 'quiz', quiz_attempts_used: 2, quiz_best_percent: '84.6', quiz_passed: true }), formatDay);
  h.check('§3 a quiz: attempts, and the best % rounded, green when passed', q.sub === 'Quiz · 2 attempts' && q.badge?.text === '85%' && q.badge.tone === 'success' && /Math\.round\(best\)/.test(web));
  h.check('§3 …amber when not passed', lineOf(item({ item_type: 'quiz', kind: 'quiz', quiz_attempts_used: 1, quiz_best_percent: 40, quiz_passed: false }), formatDay).badge?.tone === 'warning');
  const iq = lineOf(item({ interactive: { started: true, basis: 'quiz', taken: true, quiz_right: 7, quiz_total: 10 } }), formatDay);
  h.check('§3 an interactive lesson by its quiz: "7/10 right on the quiz"', iq.sub === '7/10 right on the quiz' && /" right on the quiz"/.test(web), iq.sub);
  h.check('§3 …"Quiz not taken yet"', lineOf(item({ interactive: { started: true, basis: 'quiz', taken: false } }), formatDay).sub === 'Quiz not taken yet' && /"Quiz not taken yet"/.test(web));
  h.check('§3 a completed lesson says when', lineOf(item({ completed_at: '2026-11-05T21:00:00.000Z' }), formatDay).sub === 'Completed 6 Nov 2026');
  const as = lineOf(item({ item_type: 'assignment', kind: 'assignment', assignment_status: 'approved', assignment_grade: '80' }), formatDay);
  h.check('§3 an assignment: its grade and status, and it opens', as.sub === 'Assignment · Grade 80' && as.badge?.text === 'Approved' && as.opens);
  h.check('§3 …not handed in: "To do"', lineOf(item({ item_type: 'assignment', kind: 'assignment' }), formatDay).badge?.text === 'To do');
  h.check('§3 lessons and quizzes do not open yet (the lesson player is the next bunch)', !lineOf(item({}), formatDay).opens && !q.opens && !fx.opens);

  // §4 chapters, the website's groupIntoChapters
  h.check('§4 the website groups by label', /if \(it\.kind === "label"\) \{/.test(web) && /let current = \{ id: "__lead__", title: null, lessons: \[\] \};/.test(web));
  const ch = chaptersOf([
    item({ id: 'x' }),
    item({ id: 'L1', item_type: 'label', kind: 'label', title: 'Chapter 1' }),
    item({ id: 'y' }),
    item({ id: 'z', item_type: 'quiz', kind: 'quiz' }),
    item({ id: 'L2', item_type: 'label', kind: 'label', title: 'Empty' }),
  ]);
  h.check('§4 a lead section, a chapter with its items, and an empty titled one kept', ch.length === 3 && ch[0].title === null && ch[0].items.length === 1 && ch[1].title === 'Chapter 1' && ch[1].items.map((i) => i.id).join() === 'y,z' && ch[2].title === 'Empty' && ch[2].items.length === 0);
  h.check('§4 no lead section when the list starts with a label', chaptersOf([item({ item_type: 'label', kind: 'label', title: 'A' }), item({})]).length === 1);

  // §5 the course card and the subject chip
  const prog = { enrollments: [{ enrollment: { id: 'e', course_id: 'C', course_name: 'X' }, completion: { state: 'ok', completion_percent: 63.6, completion_display: '64%', items_done: 23, items_total: 36 } }] };
  const grd = { enrollments: [{ enrollment: { id: 'e', course_id: 'C' }, state: 'ok', score_percent: 86.2, letter: 'B+' }] };
  const sum = courseSummary('C', prog, grd);
  h.check('§5 the course card: the AMS\'s items and grade', sum?.pct === 64 && sum.line === '23 of 36 items done · Grade so far 86% (B+)', sum?.line);
  h.check('§5 …no grades yet: items only', courseSummary('C', prog, { enrollments: [{ enrollment: { id: 'e', course_id: 'C' }, state: 'no_marks', score_percent: null, letter: null }] })?.line === '23 of 36 items done');
  h.check('§5 …a course with no enrolment of its own id (a class) gets no card, never a guess', courseSummary('OTHER', prog, grd) === null);
  h.check('§5 …a course whose progress is not "ok" gets no card', courseSummary('C', { enrollments: [{ ...prog.enrollments[0], completion: { ...prog.enrollments[0].completion, state: 'no_access' } }] }, grd) === null);
  h.check('§5 a paused subject says Paused', subjectChip({ frozen: true, days_left: null }, null, null)?.text === 'Paused');
  h.check('§5 nothing started: Not started', subjectChip({ frozen: false, days_left: 9 }, [item({ id: 'l1' })], 'l1')?.text === 'Not started');
  h.check('§5 on the third lesson: Now on lesson 3', subjectChip({ frozen: false, days_left: null }, [item({ id: 'a', completed_at: 'x' }), item({ id: 'b', completed_at: 'x' }), item({ id: 'c' })], 'c')?.text === 'Now on lesson 3');
  h.check('§5 every lesson done: All lessons done (never "Completed" — that is the AMS\'s verdict)', subjectChip({ frozen: false, days_left: null }, [item({ completed_at: 'x' })], null)?.text === 'All lessons done');
  h.check('§5 days left: from 7, red from 3, the website\'s red line', daysLeftLine(8) === null && daysLeftLine(7)?.urgent === false && daysLeftLine(3)?.urgent === true && daysLeftLine(1)?.text === '1 day left' && /s\.days_left <= 3 \? "text-rose-500"/.test(strip(readAmsFile('client/src/pages/student/StudentCourseSubjects.js'))));
  h.check('§5 the tile letter', initialOf('MS Excel') === 'M' && initialOf('  ') === '•' && initialOf(null) === '•');
});
