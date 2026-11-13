// The teacher's Students tab (built 8 Nov 2026): the students he teaches,
// searchable, and one student's contact, courses and attendance. Pure — no
// React Native — so students.check.ts can hold it to the AMS.
//
// The AMS decides who is listed: a teacher gets ONLY the students he teaches
// (studentsController.getAllStudents, teacherStudentScopeSql), with or
// without a search. The status is the AMS's computeStudentStatus, never
// worked out here. A student opens only from that list.

export const STUDENTS_API = {
  list: { method: 'GET', path: '/students' },
  one: { method: 'GET', path: '/students/:id' },
  attendance: { method: 'GET', path: '/students/:id/attendance' },
  // Reception (13 Nov 2026): the fee, paid and balance per enrolment, as the
  // AMS's payment summary computes them (services/enrollmentBalance.js).
  fees: { method: 'GET', path: '/payments/student/:student_id/summary' },
} as const;

/**
 * Who is looking (13 Nov 2026): the teacher's Students tab, or reception's.
 * Reception finds ANY student — the AMS searches across branches for a
 * supervisor — so its list waits for a search instead of listing the branch.
 */
export type StudentsWho = 'teacher' | 'reception';
export const STUDENTS_HOME: Record<StudentsWho, '/teacher/students' | '/reception/students'> = {
  teacher: '/teacher/students',
  reception: '/reception/students',
};
export const STUDENT_PROFILE: Record<StudentsWho, '/teacher/students/profile' | '/reception/students/profile'> = {
  teacher: '/teacher/students/profile',
  reception: '/reception/students/profile',
};

/** One enrolment's fee as the payment summary sends it — amounts as text with 3 decimals. */
export type FeeLine = {
  enrollment_id: string;
  enrollment_no: string | null;
  course_name: string | null;
  status: string | null;
  net_amount: string;
  total_paid: string;
  balance: string;
};
export type FeesAnswer = { enrollments: FeeLine[]; total_paid_overall: string; balance_overall: string };


export type Enrolment = {
  id: string;
  enrollment_no: string | null;
  status: string | null;
  course_id: string;
  course_name: string | null;
  teacher_name: string | null;
  enrolled_date: string | null;
};

/** A row of getAllStudents / the student of getStudentById — only what these screens read. */
export type StudentRow = {
  id: string;
  full_name: string | null;
  student_code: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  branch_name: string | null;
  status: string | null;
  last_present: string | null;
  enrollments: Enrolment[] | null;
};

export type AttendanceAnswer = {
  attendance_rate: number;
  total_classes: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  pending: number;
  pending_review: number;
  records: { id: string; attendance_date: string; status: string; course_name: string | null; teacher_name: string | null; batch_name: string | null }[];
};

/** The AMS's status words (computeStudentStatus), each with its tone. Anything else (a manual override) is shown as written. */
export const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'info'> = {
  Active: 'success',
  Inactive: 'warning',
  'At Risk': 'danger',
  Critical: 'danger',
  'On break': 'info',
};

/** The search the AMS is sent: trimmed, and only from 2 characters (a single letter matches nearly everyone). */
export function searchParam(text: string): string | null {
  const t = text.trim();
  return t.length >= 2 ? t : null;
}

export function listPath(search: string | null): string {
  return search ? `${STUDENTS_API.list.path}?search=${encodeURIComponent(search)}` : STUDENTS_API.list.path;
}

/** The courses line under a name: active enrolments first, each course once. */
export function coursesLine(enrolments: Enrolment[] | null | undefined): string {
  const list = [...(enrolments ?? [])].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const names: string[] = [];
  for (const e of list) if (e.course_name && !names.includes(e.course_name)) names.push(e.course_name);
  return names.join(' · ');
}

/** Digits for a phone link: a leading + kept, everything else that is not a digit dropped. */
export function dialable(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const t = phone.trim();
  const digits = t.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return (t.startsWith('+') ? '+' : '') + digits;
}

/**
 * The digits wa.me is given — the AMS's own rule (client/src/lib/waLink.js
 * waNumber), held to it by students.check §3 on a table of numbers: ONLY a
 * bare Kuwaiti mobile (8 digits starting 5, 6 or 9) gets 965; anything else is
 * passed through as written, never guessed.
 */
export const HOME_DIAL = '965';
const HOME_LOCAL_RE = /^[569]\d{7}$/;
export function waNumber(phone: string | null | undefined): string | null {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return HOME_LOCAL_RE.test(digits) ? HOME_DIAL + digits : digits;
}

/** A plain chat link to the student (no ready message: that greeting is the AMS's lead text). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = waNumber(phone);
  return d ? `https://wa.me/${d}` : null;
}

/** "Present 10 · Absent 2 · Late 1" — the counts that are not zero, in the AMS's order. */
export function attendanceLine(a: Pick<AttendanceAnswer, 'present' | 'absent' | 'late' | 'excused' | 'pending' | 'pending_review'>): string {
  const parts: [string, number][] = [
    ['Present', a.present],
    ['Absent', a.absent],
    ['Late', a.late],
    ['Excused', a.excused],
    ['Waiting', a.pending],
    ['Awaiting review', a.pending_review],
  ];
  return parts.filter(([, n]) => n > 0).map(([w, n]) => `${w} ${n}`).join(' · ');
}
