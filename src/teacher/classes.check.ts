import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import { CLASSES_API, STATUS_WORDS, classChips, classTitle, quizLine, stuckLine, type ClassSummary } from './classes.ts';

// The teacher's Classes (7 Nov 2026) against progressService: the route, the
// shape my-classes answers, and its own status words.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

run('classes.check — the teacher\'s Classes agree with the AMS', (h) => {
  const r = strip(readAmsFile('server/src/routes/progress.js'));
  const svc = strip(readAmsFile('server/src/services/progressService.js'));
  h.check('§1 the AMS files were read', r.length > 200 && svc.length > 20000);
  h.check('§1 GET /my-classes, for a teacher', /router\.get\('\/my-classes', auth, authorize\('teacher'\), c\.getMyClasses\);/.test(r) && CLASSES_API.myClasses.path === '/progress/my-classes');

  const from = svc.slice(svc.indexOf('function myClassesFrom'));
  h.check('§2 myClassesFrom extracts (floor)', from.length > 3000);
  for (const k of ['subject_id: subject.id', 'subject_name: subject.name', 'course_name: subject.course_name', 'group_name: subject.group_name || null',
    'students: inClass.length', 'avg_pct: cls.summary.avg_pct', 'counts: cls.summary.counts', 'to_mark: cls.summary.to_mark.count']) {
    h.check(`§2 each class carries ${k.split(':')[0]}`, from.includes(k));
  }
  h.check('§2 needs carries stuck, quiz, to_mark and not_started', /needs: \{ stuck, quiz, to_mark: toMark, not_started: never,/.test(from));
  h.check('§2 a stuck entry carries days and detail', /stuck\.push\(\{ \.\.\.who, days: st\.idle_days, detail: /.test(from));
  h.check('§2 a quiz entry carries title, best, attempts, left', /quiz\.push\(\{ \.\.\.who, quiz_id: it\.id, title: it\.title, best: c\.best, attempts: c\.attempts, left: c\.left,/.test(from));

  const words = /const STATUS_WORDS = \{([\s\S]*?)\};/.exec(svc)?.[1] ?? '';
  const amsWords = Object.fromEntries([...words.matchAll(/([a-z_]+): '([^']+)'/g)].map((m) => [m[1], m[2]]));
  h.check('§3 the AMS has eight status words (floor)', Object.keys(amsWords).length === 8, Object.keys(amsWords).join());
  h.check('§3 the app\'s are the AMS\'s, word for word', JSON.stringify(amsWords) === JSON.stringify(STATUS_WORDS));
  const countsInit = /const counts = \{ ([^}]*) \};/.exec(svc)?.[1] ?? '';
  h.check('§3 a class\'s counts are keyed by those statuses', Object.keys(amsWords).every((k) => countsInit.includes(k + ': 0')), countsInit);

  const c: ClassSummary = { subject_id: 's', subject_name: 'MS Word', course_name: 'Computer Secretarial', group_name: null, students: 12, branches: ['Kuwait City'],
    avg_pct: 64, counts: { stuck: 2, on_track: 8, not_started: 0, completed: 2 }, to_mark: 3 };
  h.check('§4 the class line', classTitle(c).sub === 'Computer Secretarial · 12 students · Kuwait City', classTitle(c).sub);
  h.check('§4 chips in the order a teacher acts, zeros left out', classChips(c).map((x) => x.key).join() === 'stuck,to_mark,on_track,completed');
  h.check('§4 a stuck line from the AMS\'s detail', stuckLine({ days: 9, detail: 'Stopped at Lesson 4' }) === 'Stopped at Lesson 4 · 9 days idle' && stuckLine({ days: null, detail: 'x' }) === 'x');
  h.check('§4 a quiz line', quizLine({ title: 'Quiz 1', best: 40, attempts: 2, left: 1 }) === 'Quiz 1 · best 40% · 2 tries, 1 left');
});
