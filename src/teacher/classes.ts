// The teacher's Classes (Phase 2, built 7 Nov 2026 in the bunch): each class
// he teaches with its progress, and the students who need him — stuck, failing
// a quiz, waiting to be marked, not started. Everything is
// GET /progress/my-classes as progressService computes it: the app counts and
// words nothing of its own. Pure, so classes.check.ts holds it to the AMS.

export const CLASSES_API = { myClasses: { method: 'GET', path: '/progress/my-classes' } } as const;

export type ClassSummary = {
  subject_id: string;
  subject_name: string;
  course_name: string;
  group_name: string | null;
  students: number;
  branches: string[];
  avg_pct: number | null;
  counts: Record<string, number>;
  to_mark: number;
};

type Who = { student_id: string; student_name: string; subject_name: string; course_name: string };

export type MyClasses = {
  classes: ClassSummary[];
  students: number;
  needs: {
    stuck: (Who & { days: number | null; detail: string })[];
    quiz: (Who & { title: string; best: number | null; attempts: number; left: number | null; pass_mark: number | null })[];
    to_mark: (Who & { title: string; submitted_at: string | null })[];
    not_started: (Who & { since: string | null })[];
    total: number;
  };
  week: { lessons: number; quizzes: number; assignments: number };
};

/** progressService's own words for a student's status (STATUS_WORDS). */
export const STATUS_WORDS: Record<string, string> = {
  completed: 'Completed',
  frozen: 'Frozen',
  withdrawn: 'Withdrawn',
  access_ended: 'Access ended',
  no_access: 'No access yet',
  stuck: 'Stuck',
  not_started: 'Not started',
  on_track: 'On track',
};

/** "12 students · Kuwait City", and the course with its group. */
export function classTitle(c: ClassSummary): { title: string; sub: string } {
  return {
    title: c.subject_name,
    sub: [c.course_name, c.group_name, `${c.students} ${c.students === 1 ? 'student' : 'students'}`, ...(c.branches ?? [])].filter(Boolean).join(' · '),
  };
}

/** The counts worth a chip, in the order a teacher acts on them; zeros left out. */
export function classChips(c: ClassSummary): { key: string; text: string; tone: 'danger' | 'warning' | 'success' | 'info' }[] {
  const n = c.counts ?? {};
  const out: { key: string; text: string; tone: 'danger' | 'warning' | 'success' | 'info' }[] = [];
  if (n.stuck) out.push({ key: 'stuck', text: `${n.stuck} stuck`, tone: 'danger' });
  if (c.to_mark) out.push({ key: 'to_mark', text: `${c.to_mark} to mark`, tone: 'warning' });
  if (n.not_started) out.push({ key: 'not_started', text: `${n.not_started} not started`, tone: 'warning' });
  if (n.on_track) out.push({ key: 'on_track', text: `${n.on_track} on track`, tone: 'success' });
  if (n.completed) out.push({ key: 'completed', text: `${n.completed} completed`, tone: 'info' });
  return out;
}

/** "Stopped at Lesson 4 — 9 days ago", from the AMS's own detail and days. */
export function stuckLine(s: { days: number | null; detail: string }): string {
  return s.days != null ? `${s.detail} · ${s.days} ${s.days === 1 ? 'day' : 'days'} idle` : s.detail;
}

/** "Best 40% · 2 tries, 1 left". */
export function quizLine(q: { title: string; best: number | null; attempts: number; left: number | null }): string {
  const parts = [q.title];
  if (q.best != null) parts.push(`best ${Math.round(Number(q.best))}%`);
  parts.push(`${q.attempts} ${q.attempts === 1 ? 'try' : 'tries'}` + (q.left != null ? `, ${q.left} left` : ''));
  return parts.join(' · ');
}
