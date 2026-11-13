// Reception (Phase 3, mockups 08–12, approved 3 Nov 2026; built from 13 Nov
// 2026). Pure — no React Native — so reception.check.ts holds it to the AMS's
// own routes, controllers and the website's follow-up lists.
//
// Every figure is the AMS's: today's collection, enrolments and check-ins
// come from the dashboard, the approvals waiting from its summary, the
// follow-ups from the Follow-up Centre (GET /followups/mine) — never counted
// on the phone. The AMS scopes all of it to the supervisor's branch.

// ── The AMS endpoints ───────────────────────────────────────────────────────

export const RECEPTION_API = {
  dashboard: { method: 'GET', path: '/dashboard' },
  approvals: { method: 'GET', path: '/dashboard/approvals' },
  followups: { method: 'GET', path: '/followups/mine' },
  followupCase: { method: 'GET', path: '/followups/cases/:id' },
  logFollowup: { method: 'POST', path: '/followups/cases/:id/log' },
  proofs: { method: 'GET', path: '/payment-proofs' },
  proofMethods: { method: 'GET', path: '/payment-proofs/methods' },
  approveProof: { method: 'POST', path: '/payment-proofs/:id/approve' },
  rejectProof: { method: 'POST', path: '/payment-proofs/:id/reject' },
} as const;

/** Today's figures: the dashboard asked for today only (it computes less). */
export const DASHBOARD_TODAY = `${RECEPTION_API.dashboard.path}?period=today`;

// ── Today ───────────────────────────────────────────────────────────────────

type Breakdown = { total: number };
export type Dashboard = {
  scope: { role: string; branch_id: string | null; branch_name: string | null };
  kpis: { collection_today: Breakdown; enrollments_today: Breakdown; live_attendance: Breakdown };
};
export type ApprovalsSummary = { payment_proofs: number; refunds: number; discounts: number; books: number };

export type FollowupCounts = {
  overdue: number;
  today: number;
  upcoming: number;
  waiting: number;
  attendance: number;
  payment: number;
  kd_overdue: number;
};

/** "1,240.000" — KD with the AMS's three decimals and thousands separators. */
export function kdAmount(n: number | string | null | undefined): string {
  // A figure that did not arrive is a dash, never "0.000" (Number(null) is 0).
  if (n === null || n === undefined || (typeof n === 'string' && !n.trim())) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const [whole, frac] = v.toFixed(3).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

export type Figure = { label: string; value: string; sub: string };

/** The three figure tiles of mockup 08, from the dashboard. */
export function todayFigures(d: Dashboard | null): Figure[] {
  if (!d) return [];
  return [
    { label: 'Collected', value: kdAmount(d.kpis.collection_today.total), sub: 'KD today' },
    { label: 'Enrolments', value: String(d.kpis.enrollments_today.total), sub: 'new today' },
    { label: 'Check-ins', value: String(d.kpis.live_attendance.total), sub: 'in class today' },
  ];
}

export type NeedsRow = { key: 'proofs' | 'followups' | 'fees'; label: string; count: number; tone: 'warning' | 'info' | 'danger' };

/** "Needs you" — what is waiting for reception, as the AMS counts it. A zero row is left out. */
export function needsYou(approvals: ApprovalsSummary | null, f: FollowupCounts | null): NeedsRow[] {
  const rows: NeedsRow[] = [];
  if (approvals && approvals.payment_proofs > 0) {
    rows.push({ key: 'proofs', label: approvals.payment_proofs === 1 ? 'Payment proof from a student' : 'Payment proofs from students', count: approvals.payment_proofs, tone: 'warning' });
  }
  if (f) {
    const due = f.overdue + f.today;
    if (due > 0) rows.push({ key: 'followups', label: due === 1 ? 'Follow-up due' : 'Follow-ups due', count: due, tone: 'info' });
    if (f.payment > 0) rows.push({ key: 'fees', label: f.payment === 1 ? 'Student with fees overdue' : 'Students with fees overdue', count: f.payment, tone: 'danger' });
  }
  return rows;
}

// ── Follow-ups (the Follow-up Centre's cases) ───────────────────────────────

export type Bucket = 'overdue' | 'today' | 'upcoming' | 'waiting' | 'closed';
export type FollowupCase = {
  id: string;
  student_id: string;
  kind: 'attendance' | 'payment';
  state: string;
  bucket: Bucket;
  trigger_status: string | null;
  student_name: string | null;
  student_phone: string | null;
  student_code: string | null;
  course_name: string | null;
  enrollment_no: string | null;
  last_present: string | null;
  attempts: number | null;
  last_outcome: string | null;
  last_note: string | null;
  last_log_at: string | null;
  amount_due: string | null;
  due_since: string | null;
  due_at: string | null;
  promise_date: string | null;
  escalation_level: number | null;
};
export type MineAnswer = { counts: FollowupCounts; cases: FollowupCase[]; total: number; page: number; size: number };

/** One tab of the Follow-ups screen: the AMS's own buckets. */
export const FOLLOWUP_TABS: { key: 'today' | 'overdue' | 'upcoming'; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
];

/** The list read: action cases (overdue, today, upcoming), most urgent first, one page. */
export function minePath(kind: 'attendance' | 'payment' | null = null, size = 50): string {
  return `${RECEPTION_API.followups.path}?view=action&sort=urgent&size=${size}${kind ? `&kind=${kind}` : ''}`;
}

/**
 * What a person may log on a case — the website's own lists, word for word
 * (client/src/components/followups/fuUi.js ATTENDANCE_OUTCOMES / PAYMENT_OUTCOMES),
 * held to them by reception.check. `promise`: the outcome asks for a date.
 */
export type OutcomeChoice = { key: string; label: string; promise?: true };
export const ATTENDANCE_OUTCOMES: OutcomeChoice[] = [
  { key: 'will_return', label: 'Reached – will return', promise: true },
  { key: 'sick_travel', label: 'Sick / travelling', promise: true },
  { key: 'schedule_problem', label: 'Schedule problem' },
  { key: 'wants_freeze', label: 'Wants to freeze' },
  { key: 'withdrawing', label: 'Withdrawing' },
  { key: 'no_answer', label: 'No answer' },
  { key: 'wrong_number', label: 'Wrong number' },
  { key: 'reached', label: 'Reached – other' },
];
export const PAYMENT_OUTCOMES: OutcomeChoice[] = [
  { key: 'promised_payment', label: 'Promised to pay', promise: true },
  { key: 'paid', label: 'Paid at the desk' },
  { key: 'payment_plan', label: 'Asked for payment plan' },
  { key: 'disputes', label: 'Disputes the amount' },
  { key: 'refuses', label: 'Refuses' },
  { key: 'no_answer', label: 'No answer' },
  { key: 'wrong_number', label: 'Wrong number' },
  { key: 'reached', label: 'Reached – other' },
];
export const outcomesFor = (kind: FollowupCase['kind']): OutcomeChoice[] => (kind === 'payment' ? PAYMENT_OUTCOMES : ATTENDANCE_OUTCOMES);

/** The status pill: the attendance status that opened the case, or "Fee overdue". */
export function caseBadge(c: Pick<FollowupCase, 'kind' | 'trigger_status'>): { text: string; tone: 'danger' | 'warning' | 'info' } {
  if (c.kind === 'payment') return { text: 'Fee overdue', tone: 'warning' };
  const s = c.trigger_status ?? 'Follow-up';
  return { text: s, tone: s === 'Critical' ? 'danger' : s === 'At Risk' ? 'warning' : 'info' };
}

/** Whole days from a "YYYY-MM-DD" (Kuwait) to `today` (YYYY-MM-DD). */
export function daysBetween(from: string | null | undefined, today: string): number | null {
  if (!from) return null;
  const a = Date.parse(String(from).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(today + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null;
}

export const LOG_TYPES = ['call', 'whatsapp'] as const;
export type LogType = (typeof LOG_TYPES)[number];

/**
 * A log's body, or why it cannot be sent: the AMS needs an outcome or a note;
 * a promise outcome needs its date; no date may be in the past (the AMS
 * refuses both, these only say so first).
 */
export function logBody(args: {
  type: LogType;
  outcome: OutcomeChoice | null;
  note: string;
  nextDate: string | null; // YYYY-MM-DD
  promiseDate: string | null; // YYYY-MM-DD
  promiseAmount: string;
  today: string; // YYYY-MM-DD, Kuwait
}): { ok: true; body: Record<string, unknown> } | { ok: false; message: string } {
  const note = args.note.trim();
  if (!args.outcome && !note) return { ok: false, message: 'Pick what happened or write a note.' };
  if (args.outcome?.promise && !args.promiseDate) return { ok: false, message: 'Pick the date they promised.' };
  if (args.promiseDate && args.promiseDate < args.today) return { ok: false, message: 'The promised date cannot be in the past.' };
  if (args.nextDate && args.nextDate < args.today) return { ok: false, message: 'The next follow-up date cannot be in the past.' };
  const body: Record<string, unknown> = { type: args.type };
  if (args.outcome) body.outcome = args.outcome.key;
  if (note) body.note = note.slice(0, 2000);
  if (args.nextDate) body.next_date = args.nextDate;
  if (args.outcome?.promise && args.promiseDate) body.promise_date = args.promiseDate;
  const amt = Number(args.promiseAmount);
  if (args.outcome?.promise && args.promiseAmount.trim() && Number.isFinite(amt) && amt > 0) body.promise_amount = amt;
  return { ok: true, body };
}

/** "YYYY-MM-DD" n days after a Kuwait day. */
export function addDaysYmd(ymd: string, n: number): string {
  return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}

/** The quick next-follow-up choices (the website's pickers, as chips). */
export const NEXT_CHOICES: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'In a week', days: 7 },
];

// ── Payment proofs (students' uploads, approved at the desk) ────────────────

export type ProofRow = {
  id: string;
  student_id: string;
  student_name: string | null;
  student_code: string | null;
  course_name: string | null;
  amount: string | number;
  paid_date: string | null;
  note: string | null;
  proof_url: string | null;
  submitted_at: string;
  status: string;
};
export type ProofMethod = { id: string; name: string };

/**
 * Approving records the payment (the AMS's approveProof), so the desk names
 * the method. Approve takes no key: it locks the proof, and a second approval
 * answers 409 "already been reviewed" — never a second payment. A retried
 * approve that gets that 409 has worked: reload the list.
 */
export const ALREADY_REVIEWED = 'This proof has already been reviewed';
