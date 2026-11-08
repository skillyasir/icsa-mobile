import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  ASSIGNMENT_MAX_MB,
  ASSIGNMENT_TYPES,
  PICKER_TYPES,
  STUDENT_ASSIGNMENT_API,
  UPLOAD_FIELD,
  briefText,
  canHandIn,
  commentAuthor,
  fileProblem,
  gradeLine,
  handInLabel,
  typeOf,
  uploadedUrl,
} from './assignment.ts';

// A student's assignment (8 Nov 2026) against the AMS: routed and open to a
// student, the upload's field, size and types are index.js's own, the hand-in
// rule is the website's (StudentAssignmentView.js), the teacher's comment is
// sent — and nothing in the app uploads by fetch + FormData.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';
function firewallAdmits(fw: string, method: string, path: string): boolean {
  const entries = [...fw.matchAll(/\{\s*method:\s*'([A-Z]+)',\s*path:\s*'([^']+)'\s*\}/g)].map((m) => ({ method: m[1], path: m[2] }));
  return entries.some((e) => e.method === method && (e.path.endsWith('*') ? path.startsWith(e.path.slice(0, -1)) : e.path === path));
}
const concrete = (p: string) => '/api' + p.replace(/:[A-Za-z_]\w*/g, '0b1c');

run('assignment.check — a student\'s assignment agrees with the AMS', (h) => {
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');

  // §1 routed, and open to a student
  const fw = strip(readAmsFile('server/src/middleware/studentFirewall.js'));
  const authR = strip(readAmsFile('server/src/routes/auth.js'));
  const idx = strip(readAmsFile('server/src/index.js'));
  h.check('§1 the AMS files were read', fw.length > 1500 && authR.length > 1000 && idx.length > 10000);
  const eps = Object.values(STUDENT_ASSIGNMENT_API);
  h.check('§1 five endpoints (floor)', eps.length === 5);
  for (const e of eps) h.check(`§1 ${e.method} /api${e.path} is in the student firewall`, firewallAdmits(fw, e.method, concrete(e.path)));
  h.check('§1 the student routes: one, submit, comments', /router\.get\('\/student\/assignments\/:id', auth, assignCtrl\.getMyAssignment\);/.test(authR)
    && /router\.post\('\/student\/assignments\/:id\/submit', auth, assignCtrl\.submitAssignment\);/.test(authR)
    && /router\.get\('\/student\/assignments\/submissions\/:submissionId\/comments', auth, assignCtrl\.listComments\);/.test(authR)
    && /router\.post\('\/student\/assignments\/submissions\/:submissionId\/comments', auth, assignCtrl\.addComment\);/.test(authR));
  h.check('§1 the upload: a student may call it, and it reads the field "file"',
    /app\.post\('\/api\/upload\/assignment-file', auth, canSubmitAssignment, assignmentUpload\.fields\(\[\{ name: 'file' \}\]\)/.test(idx)
    && /const canSubmitAssignment = authorize\('student',/.test(idx) && UPLOAD_FIELD === 'file');
  h.check('§1 …and answers { url } under /uploads/', /result\.url = '\/uploads\/students\/' \+ req\.files\.file\[0\]\.filename;/.test(idx));

  // §2 the file: index.js's own size and types
  h.check('§2 the size is index.js\'s', new RegExp(`const ASSIGNMENT_MAX_MB = ${ASSIGNMENT_MAX_MB};`).test(idx));
  const mimeBlock = /const ASSIGNMENT_OK_MIME = new Set\(\[([\s\S]*?)\]\);/.exec(idx)?.[1] ?? '';
  const amsMimes = [...mimeBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  h.check('§2 index.js\'s types were read (floor 10)', amsMimes.length >= 10, amsMimes.join());
  h.check('§2 the app sends exactly the types the AMS takes', JSON.stringify([...PICKER_TYPES].sort()) === JSON.stringify(amsMimes), [...PICKER_TYPES].sort().join());
  h.check('§2 the refusal is the AMS\'s words', idx.includes(`'${fileProblem({ name: 'x.zip', size: 1 })}'`), fileProblem({ name: 'x.zip', size: 1 }) ?? '');
  h.check('§2 a type by its extension, any case', typeOf('Essay.DOCX') === ASSIGNMENT_TYPES.docx && typeOf('scan.Jpg') === 'image/jpeg' && typeOf('notes') === null && typeOf('a.zip') === null);
  h.check('§2 a file over 15 MB is refused before sending; one at 15 MB is not', fileProblem({ name: 'a.pdf', size: 15 * 1024 * 1024 + 1 }) !== null && fileProblem({ name: 'a.pdf', size: 15 * 1024 * 1024 }) === null);
  h.check('§2 the upload\'s answer: a path under /uploads/, nothing else', uploadedUrl('{"url":"/uploads/students/1-a.pdf"}') === '/uploads/students/1-a.pdf' && uploadedUrl('{}') === null && uploadedUrl('{"url":"https://x"}') === null && uploadedUrl('<html>') === null);

  // §3 the rules and words are the website's
  const web = strip(readAmsFile('client/src/pages/student/StudentAssignmentView.js'));
  h.check('§3 the website\'s assignment page was read', web.length > 4000, String(web.length));
  h.check('§3 hand in when nothing is in, or after "needs revision" — the website\'s rule', /const canSubmit = !submission \|\| submission\.status === "needs_revision";/.test(web)
    && canHandIn(null) && canHandIn({ id: 's', file_url: null, submitted_at: null, grade: null, feedback: null, graded_at: null, status: 'needs_revision' })
    && !canHandIn({ id: 's', file_url: null, submitted_at: null, grade: null, feedback: null, graded_at: null, status: 'submitted' })
    && !canHandIn({ id: 's', file_url: null, submitted_at: null, grade: null, feedback: null, graded_at: null, status: 'approved' }));
  h.check('§3 Hand in, then Resubmit', handInLabel(null) === 'Hand in' && handInLabel({ id: 's', file_url: null, submitted_at: null, grade: null, feedback: null, graded_at: null, status: 'needs_revision' }) === 'Resubmit');
  h.check('§3 the website\'s size and accept list agree with index.js', /const MAX_MB = 15;/.test(web) && Object.keys(ASSIGNMENT_TYPES).every((ext) => web.includes(`.${ext}`)));
  h.check('§3 a comment by the student is "You"', commentAuthor({ author_name: 'test22', author_role: 'student' }) === 'You' && commentAuthor({ author_name: 'Sameer', author_role: 'teacher' }) === 'Sameer · teacher' && /c\.author_role === "student" \? "you"/.test(web));

  // §4 what the student is sent
  const ctl = strip(readAmsFile('server/src/controllers/assignmentsController.js'));
  const one = body(ctl, 'getMyAssignment');
  const submit = body(ctl, 'submitAssignment');
  h.check('§4 getMyAssignment and submitAssignment extract (floor)', one.length > 600 && submit.length > 600, `${one.length}/${submit.length}`);
  h.check('§4 the brief, due date, points and sample file are sent', /SELECT id, subject_id, title, brief, due_date, max_points, attachment_url, attachment_name FROM assignments/.test(one));
  h.check('§4 the teacher\'s grade AND comment (feedback) are sent', /grade, feedback, graded_at, status/.test(one) && /res\.json\(\{ assignment: a\.rows\[0\], submission: sub\.rows\[0\] \|\| null \}\)/.test(one));
  h.check('§4 the hand-in reads { file_url }', /const \{ file_url \} = req\.body;/.test(submit));
  h.check('§4 the grade out of the points', gradeLine('45', '100') === '45 / 100' && gradeLine(null, 100) === null && gradeLine('', 100) === null && gradeLine(8, null) === '8');

  // §5 the brief: words only, nothing run
  h.check('§5 paragraphs and list items on their own lines', briefText('<p>Do this.</p><ul><li>One</li><li>Two</li></ul><p>Then &amp; <b>that</b>.</p>') === 'Do this.\n\n• One\n• Two\n\nThen & that.', briefText('<p>Do this.</p><ul><li>One</li><li>Two</li></ul><p>Then &amp; <b>that</b>.</p>'));
  h.check('§5 a script or style is dropped with its content', briefText('<p>Hi</p><script>alert(1)</script><style>p{}</style>') === 'Hi');
  h.check('§5 entities by name and number', briefText('a&#39;b &#x41;&nbsp;c &lt;d&gt; &unknown;') === "a'b A c <d> &unknown;", briefText('a&#39;b &#x41;&nbsp;c &lt;d&gt; &unknown;'));
  h.check('§5 nothing in, nothing out', briefText(null) === '' && briefText('') === '');

  // §6 how it is sent: File.upload, never fetch + FormData — anywhere in the app.
  // (fees.check §6 found this the hard way on the proof, 8 Nov 2026: Expo's
  // fetch refuses React Native's { uri } file part.) A rule learned in one file
  // is held at the level where it is possible: every screen.
  const SRC = new URL('../', import.meta.url).pathname;
  const files: string[] = [];
  const walkDir = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walkDir(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.check\.ts$/.test(f)) files.push(p);
    }
  };
  walkDir(SRC);
  h.check('§6 the app\'s source was read (floor 60 files)', files.length >= 60, String(files.length));
  const formData = files.filter((f) => /new\s+FormData\s*\(/.test(strip(readFileSync(f, 'utf8'))));
  h.check('§6 no file builds a FormData', formData.length === 0, formData.map((f) => f.slice(SRC.length)).join());
  const screen = strip(readFileSync(new URL('./AssignmentScreen.tsx', import.meta.url), 'utf8'));
  h.check('§6 the assignment screen reads, and is not a stub', screen.length > 6000, String(screen.length));
  const call = /\.upload\(\s*AMS_API_URL\s*\+\s*STUDENT_ASSIGNMENT_API\.upload\.path\s*,\s*\{([\s\S]*?)\}\s*\)/.exec(screen)?.[1] ?? '';
  h.check('§6 the file goes by File.upload to the upload path', call.length > 0);
  h.check('§6 …multipart, in the field the AMS reads, with its type', /uploadType:\s*UploadType\.MULTIPART\b/.test(call) && /fieldName:\s*UPLOAD_FIELD\b/.test(call) && /mimeType:\s*picked\.type\b/.test(call));
  h.check('§6 …in the foreground, with the sign-in and a time limit', /sessionType:\s*'foreground'/.test(call) && /Authorization:\s*`Bearer \$\{tok\.value\}`/.test(call) && /signal:\s*ac\.signal\b/.test(call));
  h.check('§6 …then the hand-in names the uploaded file', /ams\.request\('POST', pathFor\(STUDENT_ASSIGNMENT_API\.submit\.path, \{ id: a\.id \}\), \{ file_url: url \}\)/.test(screen));
});
