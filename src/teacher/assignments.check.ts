import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  ASSIGNMENT_API,
  SUBMISSION_WORD,
  fileName,
  filterRows,
  reviewBody,
  rowsOf,
  type Submission,
  type SubmissionsAnswer,
} from './assignments.ts';

// Check assignments (7 Nov 2026) against the AMS: routes open to a teacher,
// the review body and its two outcomes, the score range, and the website's
// words for a submission's status.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';

const sub = (over: Partial<Submission>): Submission => ({
  id: 's', assignment_id: 'a', student_id: 'st', student_name: 'Maria', student_code: null, file_url: '/uploads/students/17-business%20letter.docx',
  submitted_at: '2026-11-02T18:14:00Z', status: 'submitted', grade: null, feedback: null, graded_at: null, comment_count: 0, ...over,
});
const ans = (subs: Submission[], max: number | string | null = 10, can = true): SubmissionsAnswer => ({
  submissions: subs, assignment: { id: 'a', title: 'Business letter', max_points: max, subject_name: 'MS Word', course_name: 'Computer Secretarial' }, can_grade: can,
});

run('assignments.check — Check assignments agrees with the AMS', (h) => {
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');

  // §1 routes, open to a teacher
  const r = strip(readAmsFile('server/src/routes/assignments.js'));
  h.check('§1 the routes were read', r.length > 800);
  h.check('§1 readers and writers include a teacher', /const assignmentReaders = authorize\('manager', 'supervisor', 'teacher'\);/.test(r) && /const assignmentWriters = authorize\('manager', 'supervisor', 'teacher'\);/.test(r));
  h.check('§1 GET /review-queue', /router\.get\('\/review-queue',\s*auth, assignmentReaders, c\.getReviewQueue\);/.test(r) && ASSIGNMENT_API.queue.path === '/assignments/review-queue');
  h.check('§1 GET /:id/submissions', /router\.get\('\/:id\/submissions', auth, assignmentReaders, c\.listSubmissions\);/.test(r) && ASSIGNMENT_API.submissions.path === '/assignments/:id/submissions');
  h.check('§1 POST /submissions/:submissionId/review', /router\.post\('\/submissions\/:submissionId\/review', auth, assignmentWriters, c\.reviewSubmission\);/.test(r) && ASSIGNMENT_API.review.path === '/assignments/submissions/:submissionId/review');

  // §2 the review body
  const ctl = strip(readAmsFile('server/src/controllers/assignmentsController.js'));
  const rev = body(ctl, 'reviewSubmission');
  const list = body(ctl, 'listSubmissions');
  h.check('§2 the handlers extract (floor)', rev.length > 1500 && list.length > 1500, `${rev.length},${list.length}`);
  h.check('§2 the AMS reads status, grade, feedback', /const \{ status, grade, feedback \} = req\.body;/.test(rev));
  h.check('§2 …and takes approved or needs_revision only', /if \(!\['approved', 'needs_revision'\]\.includes\(status\)\)/.test(rev));
  const ok8 = reviewBody('approved', '8', ' Good tone. ', 10);
  h.check('§2 a score and a comment', ok8.ok && JSON.stringify(ok8.body) === '{"status":"approved","grade":8,"feedback":"Good tone."}');
  const none = reviewBody('needs_revision', '', '', 10);
  h.check('§2 no score is no score; no comment is none', none.ok && none.body.grade === null && none.body.feedback === null && none.body.status === 'needs_revision');
  h.check('§2 the AMS refuses a mark outside 0…max_points', /if \(gradeVal < 0 \|\| gradeVal > maxPoints\)/.test(rev));
  h.check('§2 …and the app says so before sending', !reviewBody('approved', '11', '', 10).ok && !reviewBody('approved', '-1', '', 10).ok && reviewBody('approved', '10', '', 10).ok && reviewBody('approved', '0', '', 10).ok);
  h.check('§2 not a number', !reviewBody('approved', 'eight', '', 10).ok);
  h.check('§2 the submissions answer carries max_points and can_grade', /a\.max_points,/.test(list) && /can_grade: canGrade/.test(list));

  // §3 the website's words
  const web = strip(readAmsFile('client/src/pages/courses/AssignmentSubmissions.js'));
  for (const [k, v] of Object.entries(SUBMISSION_WORD)) {
    h.check(`§3 ${k} reads "${v}", as on the website`, new RegExp(`${k}:\\s*\\{ label: "${v}"`).test(web));
  }
  h.check('§3 the website reviews with { status, grade, feedback }', /reviewSubmission\(submissionId, \{ status: "needs_revision", grade, feedback \}\)/.test(web));

  // §4 the list
  const rows = rowsOf([
    ans([sub({ id: 'old', submitted_at: '2026-11-01T10:00:00Z' }), sub({ id: 'new', submitted_at: '2026-11-02T10:00:00Z' }),
      sub({ id: 'ret', status: 'needs_revision' }), sub({ id: 'ok', status: 'approved' })]),
    ans([sub({ id: 'x' })], null, false),
    { submissions: [sub({ id: 'orphan' })], assignment: null, can_grade: true },
  ]);
  h.check('§4 every submission of a known assignment, none of an unknown one (floor)', rows.length === 5 && !rows.some((x) => x.id === 'orphan'), rows.map((x) => x.id).join());
  h.check('§4 waiting ones first, oldest first', rows.slice(0, 3).map((x) => x.id).join() === 'old,new,x', rows.map((x) => x.id).join());
  h.check('§4 to check = submitted', filterRows(rows, 'to_check').every((x) => x.status === 'submitted') && filterRows(rows, 'to_check').length === 3);
  h.check('§4 returned = needs revision', filterRows(rows, 'returned').map((x) => x.id).join() === 'ret');
  h.check('§4 all = every one', filterRows(rows, 'all').length === 5);
  h.check('§4 each row knows its assignment, its marks and whether it may be marked', rows.find((x) => x.id === 'x')?.can_grade === false && rows.find((x) => x.id === 'x')?.max_points === null && rows[0].max_points === 10 && rows[0].title === 'Business letter');
  h.check('§4 the file name', fileName('/uploads/students/17-business%20letter.docx') === '17-business letter.docx' && fileName(null) === '');
});
