import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import { STUDENT_CODE_PATTERNS, isStudentCode, signInRoute } from './signInRoute.ts';

// The app must ask the same AMS endpoint the web login asks for the same
// identifier. The rule is the web's (client/src/pages/auth/Login.js); this
// check reads that file and fails the day the two differ.

/** The regex literals in the web login's `const isStudentCode = …;` line. */
function webPatterns(src: string): { source: string; flags: string }[] | null {
  const line = /const isStudentCode = (.+);/.exec(src);
  if (!line) return null;
  return [...line[1].matchAll(/\/((?:\\\/|[^/\n])+)\/([a-z]*)\.test\(/g)].map((m) => ({ source: m[1], flags: m[2] }));
}

run('signInRoute.check — which AMS sign-in an identifier goes to', (h) => {
  // §0 the extractor finds what it should, and notices when it cannot
  const planted = webPatterns('x\n      const isStudentCode = /^[0-9]+$/.test(trimmedId) || /^STU-/i.test(trimmedId);\n');
  h.check('§0 extractor reads two regexes with their flags', JSON.stringify(planted) === JSON.stringify([
    { source: '^[0-9]+$', flags: '' },
    { source: '^STU-', flags: 'i' },
  ]), JSON.stringify(planted));
  h.check('§0 extractor answers null when the line is gone', webPatterns('const other = 1;') === null);

  // §1 the same rule as the AMS web login
  const web = webPatterns(readAmsFile('client/src/pages/auth/Login.js'));
  h.check('§1 the web login still has its isStudentCode line', web !== null);
  h.check('§1 …holding exactly two patterns (cardinality floor)', web?.length === 2, JSON.stringify(web));
  const mine = STUDENT_CODE_PATTERNS.map((r) => ({ source: r.source, flags: r.flags }));
  h.check('§1 the app\'s patterns are the web\'s, flags included', JSON.stringify(mine) === JSON.stringify(web), `${JSON.stringify(mine)} vs ${JSON.stringify(web)}`);

  // §2 the routes
  const student = (id: string) => signInRoute(id).kind === 'student';
  h.check('§2 bare digits → student', student('22607084'));
  h.check('§2 STU- code → student', student('STU-12611041'));
  h.check('§2 stu- in lower case → student (the web\'s /i)', student('stu-12611041'));
  h.check('§2 an email → staff (which falls through to a student\'s email on the server)', !student('maria@example.com'));
  h.check('§2 a username → staff', !student('yasir'));
  h.check('§2 digits with letters → staff', !student('2260A'));
  h.check('§2 an autofilled trailing space does not change the route', student(' 22607084 ') && isStudentCode('STU-1 '));

  // §3 what is sent
  const s = signInRoute(' STU-12611041 ');
  const sb = s.body('p w', 'tok');
  h.check('§3 student → /auth/student-login with student_code, trimmed', s.path === '/auth/student-login' && sb.student_code === 'STU-12611041' && !('email' in sb));
  const f = signInRoute('maria@example.com ');
  const fb = f.body(' secret ', 'tok');
  h.check('§3 staff → /auth/login with email, trimmed', f.path === '/auth/login' && fb.email === 'maria@example.com' && !('student_code' in fb));
  h.check('§3 the password is sent exactly as typed — never trimmed', fb.password === ' secret ' && sb.password === 'p w');
  h.check('§3 the check token goes as turnstileToken, as the web sends it', fb.turnstileToken === 'tok' && sb.turnstileToken === 'tok');
});
