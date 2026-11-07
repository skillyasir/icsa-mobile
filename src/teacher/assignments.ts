// Check assignments (Phase 2, mockup 07, approved 3 Nov 2026; built 7 Nov
// 2026 in the bunch Yasir asked for). Pure, so assignments.check.ts holds it
// to the AMS's assignmentsController and the website's AssignmentSubmissions.
//
// The AMS decides who may mark (canGradeSubject, and a teacher only the
// students he teaches) and refuses a mark outside 0…max_points. The app shows
// the denominator and checks the same range only to say so before sending.

export const ASSIGNMENT_API = {
  queue: { method: 'GET', path: '/assignments/review-queue' },
  submissions: { method: 'GET', path: '/assignments/:id/submissions' },
  review: { method: 'POST', path: '/assignments/submissions/:submissionId/review' },
} as const;

export type QueueItem = {
  id: string;
  title: string;
  due_date: string | null;
  subject_id: string;
  subject_name: string;
  course_id: string;
  course_name: string;
  pending_count: number;
  oldest_pending: string | null;
  can_grade?: boolean;
};

export type Submission = {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  student_code: string | null;
  file_url: string | null;
  submitted_at: string;
  status: 'submitted' | 'approved' | 'needs_revision' | string;
  grade: number | string | null;
  feedback: string | null;
  graded_at: string | null;
  comment_count: number;
};

export type SubmissionsAnswer = {
  submissions: Submission[];
  assignment: { id: string; title: string; max_points: number | string | null; subject_name: string; course_name: string } | null;
  can_grade: boolean;
};

/** One row of the list: a submission with the assignment it belongs to. */
export type Row = Submission & {
  title: string;
  subject_name: string;
  course_name: string;
  max_points: number | null;
  can_grade: boolean;
};

export function rowsOf(answers: SubmissionsAnswer[]): Row[] {
  const out: Row[] = [];
  for (const a of answers) {
    const meta = a.assignment;
    if (!meta) continue;
    const max = meta.max_points == null || meta.max_points === '' ? null : Number(meta.max_points);
    for (const s of a.submissions ?? []) {
      out.push({ ...s, title: meta.title, subject_name: meta.subject_name, course_name: meta.course_name, max_points: max, can_grade: !!a.can_grade });
    }
  }
  // Oldest waiting first, as the queue orders assignments; then the rest newest first.
  return out.sort((x, y) =>
    x.status === 'submitted' && y.status === 'submitted'
      ? Date.parse(x.submitted_at) - Date.parse(y.submitted_at)
      : x.status === 'submitted'
        ? -1
        : y.status === 'submitted'
          ? 1
          : Date.parse(y.submitted_at) - Date.parse(x.submitted_at),
  );
}

export type Filter = 'to_check' | 'returned' | 'all';

export function filterRows(rows: Row[], f: Filter): Row[] {
  if (f === 'to_check') return rows.filter((r) => r.status === 'submitted');
  if (f === 'returned') return rows.filter((r) => r.status === 'needs_revision');
  return rows;
}

/** The website's words (AssignmentSubmissions STATUS_META). */
export const SUBMISSION_WORD: Record<string, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  needs_revision: 'Needs revision',
};

/** The two outcomes the AMS accepts. */
export type Outcome = 'approved' | 'needs_revision';

/**
 * The review request, or why it cannot be sent. An empty score is no score
 * (the AMS stores none); a score must be a number within 0…max_points.
 */
export function reviewBody(
  outcome: Outcome,
  score: string,
  comment: string,
  max: number | null,
): { ok: true; body: { status: Outcome; grade: number | null; feedback: string | null } } | { ok: false; message: string } {
  const raw = score.trim();
  let grade: number | null = null;
  if (raw !== '') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, message: 'The score must be a number.' };
    if (max !== null && (n < 0 || n > max)) return { ok: false, message: `The score must be between 0 and ${max}.` };
    if (max === null && n < 0) return { ok: false, message: 'The score cannot be negative.' };
    grade = n;
  }
  const text = comment.trim();
  return { ok: true, body: { status: outcome, grade, feedback: text ? text : null } };
}

/** "business-letter.docx" from "/uploads/students/1730…-business-letter.docx". */
export function fileName(url: string | null | undefined): string {
  if (!url) return '';
  const last = url.split('?')[0].split('/').pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
