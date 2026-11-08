import { readFileSync } from 'node:fs';

import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  AMS_ORIGIN,
  APP_MODE_KEY,
  PAGE_MESSAGES,
  RELOAD_AT_MOST_EVERY_MS,
  TOKEN_KEY,
  TOKEN_PUSH_EVERY_MS,
  USER_KEY,
  bootScript,
  pageLoadDecision,
  pageMessage,
  pageUser,
  subjectPageUrl,
  tokenScript,
} from './webPage.ts';

// Lessons and quizzes as the website's own pages (Yasir ruled, 8 Nov 2026),
// against the AMS: the flag, the storage keys, the message, the page and its
// ?item= are the website's own names (client/src/lib/appMode.js and the pages
// that read it) — and the scripts the app hands the page run only on the AMS's
// address, carry their values through JSON, and set nothing else. The scripts
// are RUN here, in a fake page, not read.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

/** Run a script the way the web view would, in a page at `origin`. Returns what it stored. */
function runIn(script: string, origin: string): { session: Record<string, string>; local: Record<string, string> } {
  const session: Record<string, string> = {};
  const local: Record<string, string> = {};
  const store = (m: Record<string, string>) => ({ setItem: (k: string, v: string) => void (m[k] = String(v)) });
  const window = { location: { origin }, sessionStorage: store(session), localStorage: store(local) };
  try {
    new Function('window', script)(window);
  } catch (err) {
    // A script that does not even run is a FAILED assertion below, never a check that could not run.
    session.__threw = err instanceof Error ? err.message : String(err);
  }
  return { session, local };
}

run('webPage.check — lessons and quizzes as the website\'s own pages', (h) => {
  h.check('§0 runIn runs a script and sees what it stored', runIn('window.localStorage.setItem("a","b")', 'x').local.a === 'b');
  h.check('§0 …and a script that throws is reported, not thrown', runIn('throw new Error("x")', 'x').session.__threw === 'x');

  // §1 the names are the website's own
  const am = strip(readAmsFile('client/src/lib/appMode.js'));
  const auth = strip(readAmsFile('client/src/context/AuthContext.js'));
  const cfg = strip(readAmsFile('client/src/api/config.js'));
  const app = strip(readAmsFile('client/src/App.js'));
  const subj = strip(readAmsFile('client/src/pages/student/StudentSubjectLessons.js'));
  h.check('§1 the AMS files were read', am.length > 500 && auth.length > 3000 && cfg.length > 800 && app.length > 5000 && subj.length > 15000);
  h.check('§1 the flag is the website\'s (appMode.js APP_MODE_KEY)', am.includes(`export const APP_MODE_KEY = "${APP_MODE_KEY}";`) && /getItem\(APP_MODE_KEY\) === "1"/.test(am));
  h.check('§1 the sign-in keys are the website\'s', cfg.includes(`localStorage.getItem('${TOKEN_KEY}')`) && auth.includes(`localStorage.getItem('${USER_KEY}')`));
  h.check('§1 the message is appMode.js toApp\'s shape and list', /JSON\.stringify\(\{ icsa: "ams-page", v: 1, type \}\)/.test(am) && am.includes(`authExpired: "${PAGE_MESSAGES.authExpired}"`) && Object.keys(PAGE_MESSAGES).length === 1);
  h.check('§1 the page is the website\'s subject route, inside the student layout', /<Route path="\/student" element=\{<StudentLayout \/>\}>/.test(app) && /<Route path="lessons\/subjects\/:subjectId" element=\{<StudentSubjectLessons \/>\} \/>/.test(app));
  h.check('§1 …and it opens ?item=', /useState\(\(\) => searchParams\.get\("item"\) \|\| null\)/.test(subj));
  h.check('§1 the URL', subjectPageUrl('S 1', 'L/2') === `${AMS_ORIGIN}/student/lessons/subjects/S%201?item=L%2F2` && subjectPageUrl('S', null) === `${AMS_ORIGIN}/student/lessons/subjects/S`);

  // §2 the scripts, run in a fake page
  const user = pageUser({ full_name: 'Test "22"', role: 'student', email: null, student_code: 'STU-1' });
  const nasty = 'tok"en\';</script>\\';
  const onAms = runIn(bootScript(nasty, user), AMS_ORIGIN);
  h.check('§2 on the AMS: app mode on, exactly as the website reads it', onAms.session[APP_MODE_KEY] === '1');
  h.check('§2 …the token stored exactly, however it is written (JSON, never pasted)', onAms.local[TOKEN_KEY] === nasty);
  const parsed = (() => {
    try {
      return JSON.parse(onAms.local[USER_KEY] ?? '') as { role?: string; full_name?: string };
    } catch {
      return {};
    }
  })();
  h.check('§2 …the user stored as JSON the website can parse, as a student', parsed.role === 'student' && parsed.full_name === 'Test "22"');
  h.check('§2 …and nothing else', Object.keys(onAms.session).length === 1 && Object.keys(onAms.local).sort().join() === [TOKEN_KEY, USER_KEY].sort().join());
  const elsewhere = runIn(bootScript('T', user), 'https://evil.example');
  h.check('§2 on any other address: nothing is stored', Object.keys(elsewhere.session).length === 0 && Object.keys(elsewhere.local).length === 0);
  const lookalike = runIn(bootScript('T', user), 'https://app.icsasystem.com.evil.example');
  h.check('§2 …nor on a look-alike address', Object.keys(lookalike.local).length === 0);
  const fresh = runIn(tokenScript('NEW'), AMS_ORIGIN);
  h.check('§2 a fresh sign-in replaces only the token', fresh.local[TOKEN_KEY] === 'NEW' && Object.keys(fresh.local).length === 1 && Object.keys(fresh.session).length === 0);
  h.check('§2 …and only on the AMS', Object.keys(runIn(tokenScript('NEW'), 'https://evil.example').local).length === 0);
  h.check('§2 a script ends with true (iOS needs a value back)', bootScript('T', user).endsWith(';true;') && tokenScript('T').endsWith(';true;'));

  // §3 where the web view may go
  h.check('§3 the page\'s own frames always load (a video, the slides, a lesson\'s sandbox)', pageLoadDecision({ url: 'https://www.youtube.com/embed/x', isTopFrame: false }) === 'load');
  h.check('§3 the student pages load', pageLoadDecision({ url: `${AMS_ORIGIN}/student/lessons/subjects/x?item=y`, isTopFrame: true }) === 'load' && pageLoadDecision({ url: `${AMS_ORIGIN}/student`, isTopFrame: true }) === 'load');
  h.check('§3 any other AMS page is refused (never the staff site, never /login)', pageLoadDecision({ url: `${AMS_ORIGIN}/login`, isTopFrame: true }) === 'refuse' && pageLoadDecision({ url: `${AMS_ORIGIN}/dashboard`, isTopFrame: true }) === 'refuse');
  h.check('§3 a lesson\'s material (/uploads/) opens outside, in the phone\'s browser', pageLoadDecision({ url: `${AMS_ORIGIN}/uploads/materials/1-a.pdf`, isTopFrame: true }) === 'outside' && /<a href=\{r\.url\} download /.test(strip(readAmsFile('client/src/components/lessons/LessonContent.js'))));
  h.check('§3 another site opens outside the app', pageLoadDecision({ url: 'https://icsa.us/x', isTopFrame: true }) === 'outside' && pageLoadDecision({ url: 'https://app.icsasystem.com.evil.example/', isTopFrame: true }) === 'outside');
  h.check('§3 anything stranger is refused', pageLoadDecision({ url: 'javascript:alert(1)', isTopFrame: true }) === 'refuse' && pageLoadDecision({ url: 'file:///etc/hosts', isTopFrame: true }) === 'refuse');

  // §4 what the page may say
  const msg = JSON.stringify({ icsa: 'ams-page', v: 1, type: 'auth-expired' });
  h.check('§4 the AMS page: by URL (iOS) or origin (Android)', pageMessage(msg, `${AMS_ORIGIN}/student/lessons/subjects/x`) === 'auth-expired' && pageMessage(msg, AMS_ORIGIN) === 'auth-expired');
  h.check('§4 a lesson\'s sandboxed frame ("null") or another site is ignored', pageMessage(msg, 'null') === null && pageMessage(msg, 'https://evil.example') === null && pageMessage(msg, 'https://app.icsasystem.com.evil.example') === null);
  h.check('§4 another shape or message is ignored', pageMessage(JSON.stringify({ icsa: 'lesson-bridge', v: 1, type: 'auth-expired' }), AMS_ORIGIN) === null && pageMessage(JSON.stringify({ icsa: 'ams-page', v: 1, type: 'go' }), AMS_ORIGIN) === null && pageMessage('not json', AMS_ORIGIN) === null);

  // §5 timing: the page never holds a token past its life; a failing page cannot loop
  const sess = readAmsFile('client/src/context/AuthContext.js');
  const idleDefault = Number(/SESSION_DEFAULTS = \{ idleMinutes: (\d+),/.exec(sess)?.[1]);
  const grace = Number(/TOKEN_GRACE_SECONDS = (\d+)/.exec(readAmsFile('server/src/controllers/authController.js'))?.[1]);
  h.check('§5 the AMS token life was read', idleDefault > 0 && grace > 0, `${idleDefault} min + ${grace} s`);
  h.check('§5 a fresh sign-in reaches the page well inside even a 1-minute idle setting\'s token', TOKEN_PUSH_EVERY_MS <= (60 + grace) * 1000 / 2);
  h.check('§5 a run-out sign-in reloads at most every 15 s', RELOAD_AT_MOST_EVERY_MS >= 15_000);

  // §6 the screen uses all of this, and keeps nothing
  const screen = strip(readFileSync(new URL('./LessonWebScreen.tsx', import.meta.url), 'utf8'));
  h.check('§6 the screen reads, and is not a stub', screen.length > 3000, String(screen.length));
  h.check('§6 incognito: the web view keeps nothing once closed', /\n\s*incognito\n/.test(screen));
  h.check('§6 the sign-in goes in before the page loads, main frame only', /injectedJavaScriptBeforeContentLoaded=\{boot\}/.test(screen) && /\n\s*injectedJavaScriptBeforeContentLoadedForMainFrameOnly\n/.test(screen));
  h.check('§6 every navigation is decided by pageLoadDecision; "outside" opens outside', /onShouldStartLoadWithRequest=\{\(r\) => \{\s*const d = pageLoadDecision\(r\);/.test(screen) && /if \(d === 'outside'\) Linking\.openURL\(r\.url\)/.test(screen) && /return d === 'load';/.test(screen));
  h.check('§6 messages go through pageMessage with the sender', /pageMessage\(e\.nativeEvent\.data, e\.nativeEvent\.url\)/.test(screen));
  h.check('§6 a fresh token every TOKEN_PUSH_EVERY_MS by tokenScript', /setInterval\(async \(\) => \{[\s\S]*?injectJavaScript\(tokenScript\(tok\.value\)\)[\s\S]*?\}, TOKEN_PUSH_EVERY_MS\)/.test(screen));
  h.check('§6 no cookie of the phone\'s browser is shared', /sharedCookiesEnabled=\{false\}/.test(screen));
});
