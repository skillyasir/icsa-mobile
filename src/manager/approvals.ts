// Managers, bunch 1 (14 Nov 2026): Approvals — mockup 15, approved 3 Nov 2026.
// Bunch 2 (15 Nov 2026): staff check-ins kept for review, payment transfers
// and free books — the mockups approved by Yasir on 15 Nov 2026.
// Pure — no React Native — so approvals.check.ts holds it to the AMS's own
// routes and controllers.
//
// The server decides. Approving a refund moves no money (that happens at its
// completion, with the proof); a discount is applied by the AMS in one locked
// transaction; a certificate is issued exactly as its request holds it (the
// title, printed line and photo are reviewed and stored on the request on the
// website first), under the AMS's fail-closed issuance hold. A transfer moves
// the money when it is approved — once: the AMS locks the row and refuses a
// second decision. A free book leaves stock when it is approved, and only if
// the branch has a copy. A check-in rejected makes the day absent. Every
// figure is the AMS's. A request someone already decided is said as the AMS
// says it — never as this press's own answer.

import { formatClock } from '../attendance/rules.ts';
import { houseDay } from '../reception/money.ts';
import { kdAmount } from '../reception/rules.ts';
import { KIND_LABEL, type TapKind } from '../staff/rules.ts';

export const APPROVALS_API = {
  summary: { method: 'GET', path: '/dashboard/approvals' },
  refunds: { method: 'GET', path: '/refunds' },
  approveRefund: { method: 'POST', path: '/refunds/:id/approve' },
  rejectRefund: { method: 'POST', path: '/refunds/:id/reject' },
  discounts: { method: 'GET', path: '/payments/discount-requests' },
  approveDiscount: { method: 'POST', path: '/payments/discount-requests/:id/approve' },
  rejectDiscount: { method: 'POST', path: '/payments/discount-requests/:id/reject' },
  certificates: { method: 'GET', path: '/certificates/requests' },
  approveCertificate: { method: 'POST', path: '/certificates/requests/:id/approve' },
  declineCertificate: { method: 'POST', path: '/certificates/requests/:id/decline' },
  checkins: { method: 'GET', path: '/staff-attendance/reviews' },
  decideCheckin: { method: 'POST', path: '/staff-attendance/taps/:id/decide' },
  transfers: { method: 'GET', path: '/payment-transfers' },
  approveTransfer: { method: 'POST', path: '/payment-transfers/:id/approve' },
  rejectTransfer: { method: 'POST', path: '/payment-transfers/:id/reject' },
  books: { method: 'GET', path: '/enrollments/books/approvals' },
  approveBook: { method: 'POST', path: '/enrollments/:id/books/:releaseId/approve' },
  rejectBook: { method: 'POST', path: '/enrollments/:id/books/:releaseId/reject' },
} as const;

/** The lists, pending only. */
export const REFUNDS_PENDING = `${APPROVALS_API.refunds.path}?status=initiated`;
export const DISCOUNTS_PENDING = `${APPROVALS_API.discounts.path}?status=pending`;
export const CERTIFICATES_PENDING = `${APPROVALS_API.certificates.path}?status=pending`;
/** Check-ins kept for review: the AMS lists only those (review = 'pending'). */
export const CHECKINS_PENDING = APPROVALS_API.checkins.path;
export const TRANSFERS_PENDING = `${APPROVALS_API.transfers.path}?status=requested`;
export const BOOKS_PENDING = `${APPROVALS_API.books.path}?status=pending`;

export type Kind = 'refund' | 'discount' | 'certificate' | 'checkin' | 'transfer' | 'book';
export type Filter = 'all' | Kind;
/** The order of the chips and of the cards under All. */
export const KINDS: readonly Kind[] = ['refund', 'discount', 'certificate', 'checkin', 'transfer', 'book'];

export type Refund = {
  id: string;
  amount: string | number;
  reason: string | null;
  student_name: string | null;
  course_name: string | null;
  initiated_by_name: string | null;
  initiated_at: string;
  charge_description: string | null;
  sale_item_name: string | null;
};
export type Discount = {
  id: string;
  student_name: string | null;
  student_code: string | null;
  course_name: string | null;
  requested_by_name: string | null;
  created_at: string;
  gross_amount: string | number | null;
  current_net: string | number | null;
  old_discount: string | number;
  new_discount: string | number;
  reason: string | null;
};
export type CertificateRequest = {
  id: string;
  type: string;
  stage: string;
  student_name: string | null;
  course_name: string | null;
  subject_name: string | null;
  requested_by_name: string | null;
  requested_at: string;
  note: string | null;
};
/** A tap kept for review, as GET /staff-attendance/reviews sends it (TAP_SQL + the name). */
export type Checkin = {
  id: string;
  user_id: string;
  full_name: string | null;
  work_date: string; // 'YYYY-MM-DD'
  kind: TapKind;
  time: string; // 'HH:MM', Kuwait
  place: 'office' | 'online';
  branch_name: string | null;
  expected_branch_name: string | null;
  location_ok: boolean | null;
  wifi_ok: boolean | null;
  distance_m: string | number | null;
  mocked: boolean | null;
  review_reason: string | null;
};
/** A transfer, as TRANSFER_SELECT_SQL reads it. */
export type Transfer = {
  id: string;
  amount: string | number;
  reason: string | null;
  withdraw_source: boolean;
  requested_at: string;
  from_student_name: string | null;
  from_enrollment_no: string | null;
  from_course_name: string | null;
  from_branch_name: string | null;
  to_student_name: string | null;
  to_enrollment_no: string | null;
  to_course_name: string | null;
  to_branch_name: string | null;
  requested_by_name: string | null;
};
/** A free-book request, as GET /enrollments/books/approvals sends it (with what the decision rests on). */
export type BookRequest = {
  id: string;
  enrollment_id: string;
  book_title: string | null;
  sale_price: string | number | null;
  approval_requested_at: string | null;
  student_name: string | null;
  course_name: string | null;
  branch_name: string | null;
  requested_by_name: string | null;
  stock_on_hand: number | string | null;
  fee: { net_amount: number; total_paid: number; balance: number; has_fee_schedule: boolean } | null;
  free_rule: { threshold: number | null; window_days: number; window_ends: string | null; paid_in_window: number } | null;
};

/** A certificate a manager may issue now: forwarded to him (the AMS's stage `with_manager`). */
export function readyToIssue(c: Pick<CertificateRequest, 'stage'>): boolean {
  return c.stage === 'with_manager';
}

/** Why one is not his yet, in the AMS's own words (approveCertificateRequest). */
export function notYetWords(c: Pick<CertificateRequest, 'stage'>): string {
  return c.stage === 'returned'
    ? 'Sent back for review. It can be approved once it is resubmitted and forwarded.'
    : 'Still with the Academic Supervisor. It can be approved once he forwards it.';
}

/**
 * Is this refusal the AMS saying the request was ALREADY decided (by this
 * press arriving twice, or by another manager first)? Then the card is gone,
 * not an error — reload, and say what the AMS says (settledWords).
 */
export function alreadyDecided(kind: Kind, message: string): boolean {
  if (kind === 'refund') return /^Cannot (approve|reject): refund is in status '/.test(message);
  if (kind === 'discount') return /^Request is not pending \(status: /.test(message);
  if (kind === 'checkin') return message === 'This check-in has already been settled.';
  if (kind === 'transfer') return /^This transfer is already \w+\.$/.test(message);
  if (kind === 'book') return message === 'Not awaiting approval';
  return /^This request has already been (approved|declined)\.$/.test(message);
}

/** The AMS's "already decided", said plainly — which way it went, when the AMS says. */
export function settledWords(kind: Kind, message: string): string {
  if (kind === 'refund') {
    const s = /status '(\w+)'/.exec(message)?.[1];
    return s ? `This refund is already ${s}.` : 'This refund is already decided.';
  }
  if (kind === 'discount') {
    const s = /status: (\w+)\)/.exec(message)?.[1];
    return s ? `This discount is already ${s}.` : 'This discount is already decided.';
  }
  if (kind === 'book') return 'This free book is already decided.';
  return message;
}

/** The reason each decline needs, and the body field the AMS reads it from. */
export const DECLINE_FIELD: Record<Kind, string> = {
  refund: 'rejection_reason',
  discount: 'note',
  certificate: 'reason',
  checkin: 'note',
  transfer: 'reason',
  book: 'reason',
};

/**
 * The body of a decline: the reason, trimmed. The app asks one for every
 * decline (the mockups, approved 15 Nov 2026) — the AMS insists for most,
 * and keeps it where it does not. A check-in's decision goes with it.
 */
export function declineBody(kind: Kind, reason: string): { ok: true; body: Record<string, string> } | { ok: false; message: string } {
  const r = reason.trim();
  if (!r) return { ok: false, message: 'Write the reason — the AMS keeps it with the request.' };
  const body: Record<string, string> = { [DECLINE_FIELD[kind]]: r };
  return { ok: true, body: kind === 'checkin' ? { decision: 'reject', ...body } : body };
}

/** The body of an approve: a check-in says its decision; every other approve sends none. */
export function approveBody(kind: Kind): Record<string, string> | undefined {
  return kind === 'checkin' ? { decision: 'accept' } : undefined;
}

const PLURAL: Record<Kind, string> = {
  refund: 'Refunds',
  discount: 'Discounts',
  certificate: 'Certificates',
  checkin: 'Check-ins',
  transfer: 'Transfers',
  book: 'Books',
};

/** The chips: All, then only the kinds with something waiting (Yasir, 15 Nov 2026). Every count is the cards the AMS sent. */
export function filterChips(n: Record<Kind, number>): { value: Filter; label: string }[] {
  const total = KINDS.reduce((s, k) => s + n[k], 0);
  return [{ value: 'all', label: `All ${total}` }, ...KINDS.filter((k) => n[k] > 0).map((k) => ({ value: k as Filter, label: `${PLURAL[k]} ${n[k]}` }))];
}

/** A chosen kind whose last card was decided has no chip any more: back to All. */
export function shownFilter(filter: Filter, n: Record<Kind, number>): Filter {
  return filter === 'all' || n[filter] > 0 ? filter : 'all';
}

export const CERT_TYPE_WORD: Record<string, string> = { course: 'Course certificate', typing: 'Typing certificate' };

// ── Staff check-ins ─────────────────────────────────────────────────────────

/** The AMS refuses a manager's decision on his own tap; the card says so instead of offering it. */
export const OWN_CHECKIN_WORDS = 'Another manager decides your own check-in.';
export const ownCheckin = (c: Pick<Checkin, 'user_id'>, myId: string | null | undefined): boolean =>
  !!myId && String(c.user_id).toLowerCase() === String(myId).toLowerCase();

/** "Check in · Mahboula" — an online day has no office. */
export function checkinLine(c: Checkin): string {
  const where = c.place === 'online' ? 'Online' : c.branch_name ?? c.expected_branch_name;
  return [KIND_LABEL[c.kind] ?? c.kind, where].filter(Boolean).join(' · ');
}

export type Pill = { text: string; tone: 'success' | 'danger' };

/** What the office checks answered — never the raw position. A fake-location app is said. */
export function checkinPills(c: Checkin): Pill[] {
  if (c.place === 'online') return [];
  const out: Pill[] = [];
  const m = c.distance_m === null || c.distance_m === undefined ? null : Math.round(Number(c.distance_m));
  if (c.location_ok === true) out.push({ text: m !== null && Number.isFinite(m) ? `Location ✓ ${m} m` : 'Location ✓', tone: 'success' });
  if (c.location_ok === false) out.push({ text: m !== null && Number.isFinite(m) ? `Location ✗ ${m} m` : 'Location ✗', tone: 'danger' });
  if (c.wifi_ok === true) out.push({ text: 'Wi-Fi ✓', tone: 'success' });
  if (c.wifi_ok === false) out.push({ text: 'Wi-Fi ✗', tone: 'danger' });
  if (c.mocked) out.push({ text: 'Fake-location app', tone: 'danger' });
  return out;
}

export const checkinTime = (c: Pick<Checkin, 'time'>): string => formatClock(c.time);
export const checkinDay = (c: Pick<Checkin, 'work_date'>): string => houseDay(c.work_date);

/** Rejecting a check-in makes the day absent (the AMS's own consequence); other taps say nothing. */
export const rejectWarning = (c: Pick<Checkin, 'kind'>): string | null => (c.kind === 'in' ? 'Rejecting a check-in makes the day absent.' : null);

/** "Accepted — Layla Hassan's check in." — the AMS's audit words. */
export function checkinDoneWords(c: Checkin, accepted: boolean): string {
  const whose = c.full_name ? `${c.full_name}’s` : 'the';
  return `${accepted ? 'Accepted' : 'Rejected'} — ${whose} ${(KIND_LABEL[c.kind] ?? c.kind).toLowerCase()}.`;
}

// ── Payment transfers ───────────────────────────────────────────────────────

/** "EN-1042 · Computer Secretarial · Mahboula". */
export function transferEnd(no: string | null, course: string | null, branch: string | null): string {
  return [no, course, branch].filter(Boolean).join(' · ');
}

/** When approving also withdraws the source enrolment, the card says so before the press. */
export const transferWarning = (t: Pick<Transfer, 'withdraw_source' | 'from_enrollment_no'>): string | null =>
  t.withdraw_source ? `Approving also withdraws ${t.from_enrollment_no ?? 'the first enrolment'}.` : null;

/** "Approved — KD 120.000 moved from EN-1042 to EN-1103, and EN-1042 withdrawn." */
export function transferDoneWords(t: Transfer, withdrawn: boolean): string {
  return `Approved — KD ${kdAmount(t.amount)} moved from ${t.from_enrollment_no ?? 'one enrolment'} to ${t.to_enrollment_no ?? 'the other'}${withdrawn ? `, and ${t.from_enrollment_no ?? 'the first'} withdrawn` : ''}.`;
}

// ── Free books ──────────────────────────────────────────────────────────────

/** The AMS's refusal when the branch has no copy, word for word. */
export const OUT_OF_STOCK_WORDS = 'Out of stock at this branch. Receive or transfer a copy first, then approve.';

export const bookInStock = (b: Pick<BookRequest, 'stock_on_hand'>): boolean => (Number(b.stock_on_hand) || 0) > 0;

export function stockPill(b: Pick<BookRequest, 'stock_on_hand' | 'branch_name'>): Pill {
  const n = Number(b.stock_on_hand) || 0;
  const at = b.branch_name ? ` at ${b.branch_name}` : '';
  return n > 0 ? { text: `${n} in stock${at}`, tone: 'success' } : { text: `None in stock${at}`, tone: 'danger' };
}

/** "KD 90.000 paid of KD 180.000 · balance KD 90.000" — no fee plan is not the same as paid in full. */
export function bookFeeLine(b: Pick<BookRequest, 'fee'>): string {
  if (!b.fee) return '';
  if (!b.fee.has_fee_schedule) return 'No fee plan on record';
  return `KD ${kdAmount(b.fee.total_paid)} paid of KD ${kdAmount(b.fee.net_amount)} · balance KD ${kdAmount(b.fee.balance)}`;
}

/** "KD 100.000 paid within 10 days (by 18 Nov 2026) — paid KD 90.000 so far". */
export function bookRuleLine(b: Pick<BookRequest, 'free_rule'>): string {
  const r = b.free_rule;
  if (!r) return '';
  if (r.threshold === null) return 'No free-book rule on this course';
  const by = r.window_ends ? ` (by ${houseDay(r.window_ends)})` : '';
  return `KD ${kdAmount(r.threshold)} paid within ${r.window_days} days${by} — paid KD ${kdAmount(r.paid_in_window)} so far`;
}

export const bookDoneWords = (b: BookRequest): string => `Released free — ${b.book_title ?? 'the book'} to ${b.student_name ?? 'the student'}.`;
