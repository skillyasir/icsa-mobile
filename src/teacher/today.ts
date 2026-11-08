// The teacher's Today and Mark class (Phase 2 piece 2, mockups 05 and 06,
// approved 3 Nov 2026). Pure — no React Native — so today.check.ts can hold it
// to the AMS's controller and the website's teacher card.
//
// The AMS decides every mark: who may mark what (checkStaffPermission), only
// today for a teacher, never a record awaiting review, a no-show cannot be
// marked into existence. These rules only decide what to show and what to send.
//
// Yasir ruled, 24 Jul 2026 (the PRESENT-ONLY decision): a walk-in (individual)
// check-in exists only because the student pressed it, so it gets ONE green
// Present. A batch class keeps present / late / absent / excused — there the
// teacher sees every enrolled student, no-shows included.

export const TEACHER_API = {
  context: { method: 'GET', path: '/attendance/staff-context' },
  confirmPresent: { method: 'POST', path: '/attendance/confirm-present' },
  confirmIndividual: { method: 'POST', path: '/attendance/individual/:enrollment_id/confirm' },
  confirmSession: { method: 'POST', path: '/attendance/sessions/:session_id/confirm' },
  reviewQueue: { method: 'GET', path: '/assignments/review-queue' },
  myClasses: { method: 'GET', path: '/progress/my-classes' },
} as const;

/**
 * Fill a path's `:name` parameters. The AMS names them both ways —
 * `:session_id` and `:submissionId` — so a name is any identifier. Until
 * 8 Nov 2026 this matched lowercase and underscore only, so `:submissionId`
 * was read as `:submission` and the review went to `/submissions/Id/review`
 * (the AMS: "Invalid value in request"). A name the caller did not give is a
 * mistake in the app: it throws rather than send a path the AMS would read as
 * an id. today.check §1b holds every path and every call site to this.
 */
export function pathFor(path: string, params: Record<string, string>): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, k)) throw new Error(`pathFor: no value for :${k} in ${path}`);
    return encodeURIComponent(params[k]);
  });
}

// ── What staff-context answers (attendanceController.getStaffContext) ───────

export type RosterRow = {
  enrollment_id: string;
  student_id: string;
  student_code: string | null;
  student_name: string;
  attendance_id: string | null;
  status: string | null;
  check_in_time: string | null;
  check_in_distance_m: number | null;
  notes: string | null;
  attendance_mode: 'classroom' | 'online' | null;
  attended_branch_name: string | null;
};

export type Session = {
  session_id: string;
  session_date: string;
  batch_name: string | null;
  course_name: string | null;
  start_time: string | null;
  hours_per_session: number | string | null;
  window_open_at: string | null;
  window_close_at: string | null;
  branch_name: string | null;
  teacher_name: string | null;
  teacher_id: string | null;
  roster: RosterRow[];
};

export type WalkIn = {
  attendance_id: string;
  enrollment_id: string;
  enrollment_no: string | null;
  student_id: string;
  student_name: string;
  student_code: string | null;
  course_name: string | null;
  status: string;
  check_in_time: string | null;
  check_in_distance_m: number | null;
  notes: string | null;
  attendance_mode: 'classroom' | 'online' | null;
  attended_branch_name: string | null;
  teacher_name: string | null;
};

export type StaffContext = {
  date: string;
  today: string;
  role: string;
  scope: 'mine' | 'all';
  can_scope: boolean;
  read_only: boolean;
  sessions: Session[];
  individual_pending: WalkIn[];
};

// ── Waiting for you ─────────────────────────────────────────────────────────

/**
 * The website's order (TeacherAttendanceCard pendingRank): an ONLINE pending
 * check-in first — that student is in a live class right now — then the other
 * pending ones, then those awaiting review, then the rest.
 */
export function pendingRank(r: { status: string; attendance_mode: string | null }): number {
  if (r.status === 'pending') return r.attendance_mode === 'online' ? 0 : 1;
  if (r.status === 'pending_review') return 2;
  return 3;
}

/** Walk-ins still to confirm (pending), or that only a supervisor may settle (pending_review). */
export function waitingList(ctx: StaffContext | null | undefined): WalkIn[] {
  const list = (ctx?.individual_pending ?? []).filter((r) => r.status === 'pending' || r.status === 'pending_review');
  return list.map((r, i) => ({ r, i })).sort((a, b) => pendingRank(a.r) - pendingRank(b.r) || a.i - b.i).map((x) => x.r);
}

/** Today's walk-ins already marked. */
export function doneList(ctx: StaffContext | null | undefined): WalkIn[] {
  return (ctx?.individual_pending ?? []).filter((r) => r.status !== 'pending' && r.status !== 'pending_review');
}

/** What "Confirm all" sends: every PLAIN pending check-in; review ones are left for a supervisor. */
export function confirmAllIds(list: WalkIn[]): string[] {
  return list.filter((r) => r.status === 'pending').map((r) => r.attendance_id);
}

/** "3:41 PM · 42 m · Computer Secretarial", or "in class since 3:41 PM · Online". */
export function walkInLine(r: WalkIn, formatTime: (v: string | null) => string): string {
  const parts: string[] = [];
  const at = formatTime(r.check_in_time);
  if (r.attendance_mode === 'online') {
    if (at) parts.push(`in class since ${at}`);
    parts.push('Online');
  } else {
    if (at) parts.push(at);
    if (r.check_in_distance_m != null) parts.push(`${Math.round(Number(r.check_in_distance_m))} m`);
  }
  if (r.course_name) parts.push(r.course_name);
  return parts.join(' · ');
}

/** The website's initials (TeacherAttendanceCard initialsOf). */
export function initials(name: string | null | undefined): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Mark class ──────────────────────────────────────────────────────────────

/** What a teacher may set on a batch roster — the website's SETTABLE. */
export const SETTABLE = ['present', 'late', 'absent', 'excused'] as const;
export type Settable = (typeof SETTABLE)[number];

/**
 * Whether this row's mark can be changed here. Not on a past day (the AMS
 * sends read_only), not a check-in awaiting review (a supervisor's), and not a
 * student who never checked in — the AMS keeps no record to mark and skips it.
 */
export function rowMarkable(row: RosterRow, readOnly: boolean): boolean {
  return !readOnly && !!row.attendance_id && row.status !== 'pending_review';
}

export type Drafts = Record<string, Settable>;

/** Choose a mark; choosing the row's own status again takes the change back (the website's rule). */
export function setDraft(drafts: Drafts, row: RosterRow, status: Settable): Drafts {
  const next = { ...drafts };
  if (status === row.status) delete next[row.enrollment_id];
  else next[row.enrollment_id] = status;
  return next;
}

/** The body of POST /attendance/sessions/:id/confirm. */
export function sessionChanges(drafts: Drafts): { changes: { enrollment_id: string; status: Settable }[] } {
  return { changes: Object.entries(drafts).map(([enrollment_id, status]) => ({ enrollment_id, status })) };
}

/** The tiles on Mark class: as marked now, with this screen's changes applied. */
export function rosterCounts(roster: RosterRow[], drafts: Drafts): {
  present: number;
  late: number;
  absent: number;
  excused: number;
  waiting: number;
  none: number;
} {
  const n = { present: 0, late: 0, absent: 0, excused: 0, waiting: 0, none: 0 };
  for (const r of roster) {
    const s = drafts[r.enrollment_id] ?? r.status;
    if (!r.attendance_id || !s) n.none++;
    else if (s === 'present' || s === 'late' || s === 'absent' || s === 'excused') n[s]++;
    else n.waiting++;
  }
  return n;
}

/** How many on the roster checked in today (have a record). */
export function checkedIn(roster: RosterRow[]): number {
  return roster.filter((r) => !!r.attendance_id).length;
}

/** "18 min late": a check-in after the class's start, in Kuwait time. A hint only — the teacher chooses. */
export function minutesLate(startTime: string | null | undefined, checkInIso: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(startTime ?? '');
  const t = checkInIso ? Date.parse(checkInIso) : NaN;
  if (!m || !Number.isFinite(t)) return 0;
  const k = new Date(t + 3 * 60 * 60 * 1000); // Kuwait = UTC+3, no daylight saving
  const late = k.getUTCHours() * 60 + k.getUTCMinutes() - (Number(m[1]) * 60 + Number(m[2]));
  return late > 0 ? late : 0;
}

/** The body of POST /attendance/individual/:enrollment_id/confirm — Present only (24 Jul 2026). */
export function presentBody(r: WalkIn): { attendance_id: string; status: 'present' } {
  return { attendance_id: r.attendance_id, status: 'present' };
}

/** The body of POST /attendance/confirm-present. */
export function confirmAllBody(ids: string[]): { attendance_ids: string[] } {
  return { attendance_ids: ids };
}

// ── The two tiles ───────────────────────────────────────────────────────────

/** Students stuck, each counted once however many subjects they are stuck in. */
export function stuckStudents(myClasses: { needs?: { stuck?: { student_id: string }[] } } | null | undefined): number {
  return new Set((myClasses?.needs?.stuck ?? []).map((s) => s.student_id)).size;
}
