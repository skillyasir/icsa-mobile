// One assignment, for the student (built 8 Nov 2026): the brief, the
// student's submission, the teacher's grade and comment, handing in a file or
// a photo, and the comment thread. Pure — no React Native — so
// assignment.check.ts can hold it to the AMS and to the website's own page
// (client/src/pages/student/StudentAssignmentView.js).
//
// The AMS decides: who may see the assignment (studentHasAssignmentAccess),
// what a file may be (ASSIGNMENT_OK_MIME, ASSIGNMENT_MAX_MB in index.js), and
// that a hand-in resets the review. These rules only steer the screen.

export const STUDENT_ASSIGNMENT_API = {
  one: { method: 'GET', path: '/auth/student/assignments/:id' },
  upload: { method: 'POST', path: '/upload/assignment-file' },
  submit: { method: 'POST', path: '/auth/student/assignments/:id/submit' },
  comments: { method: 'GET', path: '/auth/student/assignments/submissions/:submissionId/comments' },
  comment: { method: 'POST', path: '/auth/student/assignments/submissions/:submissionId/comments' },
} as const;

/** The multipart field the upload reads (`assignmentUpload.fields([{ name: 'file' }])`). */
export const UPLOAD_FIELD = 'file';

/** assignmentsController.getMyAssignment */
export type MyAssignment = {
  assignment: {
    id: string;
    subject_id: string;
    title: string;
    brief: string | null;
    due_date: string | null;
    max_points: number | string | null;
    attachment_url: string | null;
    attachment_name: string | null;
  } | null;
  submission: {
    id: string;
    file_url: string | null;
    submitted_at: string | null;
    grade: number | string | null;
    feedback: string | null;
    graded_at: string | null;
    status: string;
  } | null;
};

export type Comment = { id: string; author_name: string | null; author_role: string; body: string; created_at: string };

/** The website's rule: hand in when nothing is in yet, or when the teacher asked for a revision. */
export function canHandIn(sub: MyAssignment['submission']): boolean {
  return !sub || sub.status === 'needs_revision';
}

export function handInLabel(sub: MyAssignment['submission']): string {
  return sub ? 'Resubmit' : 'Hand in';
}

// ── The file ────────────────────────────────────────────────────────────────

/** index.js ASSIGNMENT_MAX_MB. */
export const ASSIGNMENT_MAX_MB = 15;

/** index.js ASSIGNMENT_OK_MIME, by the extension a picked file carries. */
export const ASSIGNMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** The picker's filter: every type the AMS takes, and nothing else. */
export const PICKER_TYPES: string[] = [...new Set(Object.values(ASSIGNMENT_TYPES))];

/** The type to send for a picked file, from its name — or null when the AMS would refuse it. */
export function typeOf(name: string | null | undefined): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(name ?? '');
  return m ? (ASSIGNMENT_TYPES[m[1].toLowerCase()] ?? null) : null;
}

/** Checked before sending, in the server's words; the server's own filter is still the gate. */
export function fileProblem(f: { name: string | null | undefined; size: number | null | undefined }): string | null {
  if (!typeOf(f.name)) return 'Allowed: PDF, Word, Excel, or an image (jpg/png/gif/webp/heic)';
  if (f.size != null && f.size > ASSIGNMENT_MAX_MB * 1024 * 1024) return `The file must be under ${ASSIGNMENT_MAX_MB} MB.`;
  return null;
}

/** A photo handed in is read by a teacher: kept sharper than a payment proof. */
export const PHOTO_MAX_DIM = 2400;
export const PHOTO_QUALITY = 0.85;

/** The upload answers `{ url }`; nothing else is a file the hand-in can name. */
export function uploadedUrl(body: string): string | null {
  try {
    const j = JSON.parse(body) as { url?: unknown };
    return typeof j.url === 'string' && j.url.startsWith('/uploads/') ? j.url : null;
  } catch {
    return null;
  }
}

// ── Words ───────────────────────────────────────────────────────────────────

/** "45 / 100" — the grade out of the assignment's points, as the teacher marked it. */
export function gradeLine(grade: number | string | null | undefined, max: number | string | null | undefined): string | null {
  if (grade == null || grade === '') return null;
  const g = Number(grade);
  if (!Number.isFinite(g)) return null;
  const m = max == null || max === '' ? null : Number(max);
  return m != null && Number.isFinite(m) ? `${g} / ${m}` : String(g);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/**
 * The brief is the teacher's rich text (HTML, sanitised on the website). The
 * phone shows its words: paragraphs and list items on their own lines, tags
 * gone, entities read. Nothing in it is run or followed.
 */
export function briefText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/(p|div|h[1-6]|ul|ol|tr)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (all, e: string) => {
      const k = e.toLowerCase();
      if (ENTITIES[k] !== undefined) return ENTITIES[k];
      if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
      return all;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Who wrote a comment, as the website says it: "you" for the student. */
export function commentAuthor(c: Pick<Comment, 'author_name' | 'author_role'>): string {
  return c.author_role === 'student' ? 'You' : `${c.author_name ?? 'Staff'} · ${c.author_role}`;
}
