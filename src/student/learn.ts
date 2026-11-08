// The student's Learn tab (mockup 03, built 8 Nov 2026): the course, its
// progress and grade so far, the subjects, and each subject's lessons,
// quizzes and assignments. Pure — no React Native — so learn.check.ts can hold
// it to the AMS's controllers and the website's own subject page.
//
// The AMS decides everything: which subjects the student may open (access,
// freeze, expiry), what is published, the course's progress and grade. These
// rules only decide how to SAY it. Counts here are counts of what the AMS
// sent, never a second "done" rule: a subject card says how many lessons are
// completed and how many quizzes were taken, not whether the subject is done.

export const LEARN_API = {
  courses: { method: 'GET', path: '/auth/student/courses' },
  subjects: { method: 'GET', path: '/auth/student/courses/:courseId/subjects' },
  items: { method: 'GET', path: '/auth/student/subjects/:subjectId/lessons' },
  progress: { method: 'GET', path: '/auth/student/progress' },
  grades: { method: 'GET', path: '/auth/student/grades' },
} as const;

// ── What the AMS answers ────────────────────────────────────────────────────

/** lessonsController.getMyCourses */
export type Course = { id: string; name: string; subject_count: number; frozen: boolean };

/** lessonsController.getMySubjects */
export type Subject = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  color: string | null;
  frozen: boolean;
  expires_at: string | null;
  days_left: number | null;
  lesson_count: number;
};

/** One row of lessonsController.getMySubjectLessons' `lessons` (labels, lessons, quizzes, assignments). */
export type Item = {
  item_type: 'label' | 'lesson' | 'quiz' | 'assignment';
  id: string;
  title: string | null;
  kind: string;
  lesson_type: string | null;
  duration_minutes: number | null;
  completed_at: string | null;
  assignment_status: string | null;
  assignment_grade: number | string | null;
  quiz_attempts_used: number | null;
  quiz_best_percent: number | string | null;
  quiz_passed: boolean | null;
  quiz_max_attempts: number | null;
  interactive?: { basis?: string; taken?: boolean; quiz_right?: number; quiz_total?: number; pct?: number; started?: boolean } | null;
  final_exam?: { locked: boolean; missing: unknown[] } | null;
};

export type SubjectLessons = {
  subject: { subject_name: string; course_name: string; course_id: string };
  lessons: Item[];
  resume_lesson_id: string | null;
  progress: { completed: number; total: number };
};

/** studentAcademicController.getMyProgress */
export type MyProgress = {
  enrollments: {
    enrollment: { id: string; course_id: string; course_name: string };
    completion: { state: string; completion_percent: number | null; completion_display: string | null; items_done: number; items_total: number };
  }[];
};

/** studentAcademicController.getMyGrades */
export type MyGrades = {
  enrollments: { enrollment: { id: string; course_id: string }; state: string; score_percent: number | null; letter: string | null }[];
};

// ── The course card ─────────────────────────────────────────────────────────

/**
 * The course's ring and line, from the AMS's own figures for the enrolment in
 * this course. A course the student reaches through a class (a child course)
 * has no enrolment of its own id, so it gets no card rather than a guess.
 */
export function courseSummary(
  courseId: string,
  progress: MyProgress | null | undefined,
  grades: MyGrades | null | undefined,
): { pct: number; line: string } | null {
  const p = progress?.enrollments.find((e) => e.enrollment.course_id === courseId);
  if (!p || p.completion.state !== 'ok') return null;
  const pct = Math.max(0, Math.min(100, Math.round(Number(p.completion.completion_percent) || 0)));
  const parts = [`${p.completion.items_done} of ${p.completion.items_total} items done`];
  const g = grades?.enrollments.find((e) => e.enrollment.course_id === courseId);
  if (g && g.state === 'ok' && g.score_percent != null) {
    parts.push(`Grade so far ${Math.round(Number(g.score_percent))}%${g.letter ? ` (${g.letter})` : ''}`);
  }
  return { pct, line: parts.join(' · ') };
}

// ── The subject card ────────────────────────────────────────────────────────

export type SubjectCounts = {
  lessons: { done: number; total: number };
  quizzes: { taken: number; total: number };
  assignments: { handedIn: number; total: number };
};

/** What the subject's own list says, counted — the same three counts the website's subject page shows. */
export function countsOf(items: Item[]): SubjectCounts {
  const lessons = items.filter((i) => i.item_type === 'lesson');
  const quizzes = items.filter((i) => i.item_type === 'quiz');
  const assignments = items.filter((i) => i.item_type === 'assignment');
  return {
    lessons: { done: lessons.filter((i) => !!i.completed_at).length, total: lessons.length },
    quizzes: { taken: quizzes.filter((i) => (Number(i.quiz_attempts_used) || 0) > 0).length, total: quizzes.length },
    assignments: { handedIn: assignments.filter((i) => !!i.assignment_status).length, total: assignments.length },
  };
}

/** "Lessons 6/14 · quizzes 2/5 · assignments 1/3" — a type the subject does not have is left out. */
export function countsLine(c: SubjectCounts): string {
  const parts = [`Lessons ${c.lessons.done}/${c.lessons.total}`];
  if (c.quizzes.total) parts.push(`quizzes ${c.quizzes.taken}/${c.quizzes.total}`);
  if (c.assignments.total) parts.push(`assignments ${c.assignments.handedIn}/${c.assignments.total}`);
  return parts.join(' · ');
}

export type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

/** The subject's chip. Not a "completed" verdict — that is the AMS's — only where the student is. */
export function subjectChip(s: Pick<Subject, 'frozen' | 'days_left'>, items: Item[] | null, resumeId: string | null): { text: string; tone: Tone } | null {
  if (s.frozen) return { text: 'Paused', tone: 'muted' };
  if (s.days_left === 0) return { text: 'Access ended', tone: 'danger' };
  if (!items) return null;
  const c = countsOf(items);
  if (c.lessons.total > 0 && c.lessons.done === c.lessons.total) return { text: 'All lessons done', tone: 'success' };
  const started = c.lessons.done + c.quizzes.taken + c.assignments.handedIn > 0;
  if (!started) return { text: 'Not started', tone: 'muted' };
  const lessons = items.filter((i) => i.item_type === 'lesson');
  const at = lessons.findIndex((i) => i.id === resumeId);
  return at >= 0 ? { text: `Now on lesson ${at + 1}`, tone: 'info' } : null;
}

/** "3 days left" — shown from 7 days, red from 3 (the website's red line). */
export function daysLeftLine(days: number | null | undefined): { text: string; urgent: boolean } | null {
  if (days == null || days > 7) return null;
  if (days <= 0) return { text: 'Access ended', urgent: true };
  return { text: `${days} day${days === 1 ? '' : 's'} left`, urgent: days <= 3 };
}

/** The letter on the subject's tile: its first letter. */
export function initialOf(name: string | null | undefined): string {
  const m = /[A-Za-z0-9؀-ۿ]/.exec(name ?? '');
  return m ? m[0].toUpperCase() : '•';
}

// ── The subject screen ──────────────────────────────────────────────────────

export type Chapter = { id: string; title: string | null; items: Item[] };

/** A label starts a chapter; items before the first label go in an unnamed one (the website's groupIntoChapters). */
export function chaptersOf(items: Item[]): Chapter[] {
  const out: Chapter[] = [];
  let cur: Chapter = { id: '__lead__', title: null, items: [] };
  for (const it of items) {
    if (it.item_type === 'label' || it.kind === 'label') {
      if (cur.items.length || cur.title) out.push(cur);
      cur = { id: it.id, title: it.title, items: [] };
    } else {
      cur.items.push(it);
    }
  }
  if (cur.items.length || cur.title) out.push(cur);
  return out;
}

const LESSON_TYPE: Record<string, string> = {
  video: 'Video',
  stream: 'Live stream',
  reading: 'Reading',
  quiz: 'Quiz lesson',
  slides: 'Presentation',
  html: 'Interactive',
};

export type Line = {
  kind: 'lesson' | 'quiz' | 'final' | 'assignment';
  title: string;
  sub: string;
  badge: { text: string; tone: Tone } | null;
  done: boolean;
  /** An assignment opens in the app's own screen; a lesson or a quiz as the website's page (Yasir ruled, 8 Nov 2026 — webPage.ts). */
  opens: 'assignment' | 'page';
};

export const SUBMISSION_STATUS: Record<string, { text: string; tone: Tone }> = {
  submitted: { text: 'Submitted', tone: 'info' },
  approved: { text: 'Approved', tone: 'success' },
  needs_revision: { text: 'Needs revision', tone: 'warning' },
};

/** One row of the subject's list, in the website's words. */
export function lineOf(it: Item, day: (v: string) => string): Line {
  const title = it.title ?? '';
  if (it.item_type === 'assignment') {
    const grade = it.assignment_grade == null || it.assignment_grade === '' ? null : Number(it.assignment_grade);
    return {
      kind: 'assignment',
      title,
      sub: grade == null ? 'Assignment' : `Assignment · Grade ${grade}`,
      badge: it.assignment_status ? (SUBMISSION_STATUS[it.assignment_status] ?? { text: it.assignment_status, tone: 'muted' }) : { text: 'To do', tone: 'muted' },
      done: !!it.assignment_status,
      opens: 'assignment',
    };
  }
  if (it.item_type === 'quiz') {
    const used = Number(it.quiz_attempts_used) || 0;
    const best = it.quiz_best_percent == null || it.quiz_best_percent === '' ? null : Math.round(Number(it.quiz_best_percent));
    const fx = it.final_exam ?? null;
    const missing = fx?.missing?.length ?? 0;
    const head = fx ? `Final exam${fx.locked ? ` · opens when you finish ${missing} more item${missing === 1 ? '' : 's'}` : ''}` : 'Quiz';
    return {
      kind: fx ? 'final' : 'quiz',
      title,
      sub: head + (used ? ` · ${used} attempt${used === 1 ? '' : 's'}` : ''),
      badge: best == null ? null : { text: `${best}%`, tone: it.quiz_passed ? 'success' : 'warning' },
      done: used > 0,
      opens: 'page',
    };
  }
  const done = !!it.completed_at;
  const meta: string[] = [];
  if (it.duration_minutes) meta.push(`${it.duration_minutes} min`);
  if (it.lesson_type && it.lesson_type !== 'standard') meta.push(LESSON_TYPE[it.lesson_type] ?? it.lesson_type);
  const li = it.interactive;
  if (li && li.started && !done) {
    meta.push(li.basis === 'quiz' ? (li.taken ? `${li.quiz_right}/${li.quiz_total} right on the quiz` : 'Quiz not taken yet') : `${li.pct ?? 0}% done`);
  }
  return {
    kind: 'lesson',
    title,
    sub: done && it.completed_at ? `Completed ${day(it.completed_at)}` : meta.join(' · '),
    badge: null,
    done,
    opens: 'page',
  };
}
