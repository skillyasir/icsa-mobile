// Reception 2b (14 Nov 2026): register a student, enrol, take a payment, and
// share the receipt. Pure — no React Native — so money.check.ts holds it to
// the AMS's own controllers and RUNS the AMS's enrolment code beside this copy.
//
// Yasir's rulings for this piece:
//   - 14 Nov 2026: no Civil ID scan in the app — the details are typed in.
//   - 13 Nov 2026: an in-flight press is never re-run; a person checks.
//
// One owner for each rule. The enrolment sequence is the AMS's
// client/src/lib/enrollmentFlow.js (one transaction: POST /enrollments/full),
// the instalment split is lib/installments.js, the dial prefix is
// lib/phonePrefix.js, the payment body is enrollmentFlow's postPayment, and the
// country lists are utils/countries.js (vendored verbatim). The functions below
// are TypeScript copies of those, and money.check.ts runs the AMS's own source
// on the same inputs and requires the same answers — so a change there turns
// the check red here instead of drifting.
//
// The server decides. Every refusal the app shows is the AMS's own words; the
// checks here only stop a press that the AMS would refuse anyway.

import { mayAlreadyBeSaved, sameKeyMayRetry, type PressKey } from '../api/idempotency.ts';
import type { Outcome } from '../api/session.ts';
import { COUNTRY_DATA, DIAL_CODES, buildList, PRIORITY_COUNTRY_CODES, PRIORITY_NATIONALITY_CODES } from '../vendor/ams/countries.ts';

// ── The AMS endpoints ───────────────────────────────────────────────────────

export const MONEY_API = {
  register: { method: 'POST', path: '/students' },
  duplicates: { method: 'GET', path: '/students/duplicate-check' },
  enrol: { method: 'POST', path: '/enrollments/full' },
  pay: { method: 'POST', path: '/payments' },
  proofUpload: { method: 'POST', path: '/uploads/payment-proof' },
  receiptPdf: { method: 'GET', path: '/enrollments/:id/receipt.pdf' },
  courses: { method: 'GET', path: '/courses' },
  courseTeachers: { method: 'GET', path: '/courses/:id/teachers' },
  courseBatches: { method: 'GET', path: '/courses/:id/schedules' },
  methods: { method: 'GET', path: '/payment-methods' },
  // The student and their fee summary are STUDENTS_API.one and STUDENTS_API.fees (teacher/students.ts).
} as const;

/** The upload field the AMS reads for a payment proof (routes/uploads.js: upload.single('proof')). */
export const PROOF_UPLOAD_FIELD = 'proof';

/** The AMS's 409 IN_PROGRESS, in the person's words (docs/07, word for word). */
export const IN_PROGRESS_WORDS = "This is already being saved, or may already have been. Check the student's record before trying again.";

/**
 * After a money press (AMS S5): settle the press's key and say what happened.
 * A 409 IN_PROGRESS is never retried and keeps no key — a person checks the
 * student's record first (Yasir, 13 Nov 2026). No answer, a 5xx or 503: the
 * key is kept, so pressing again cannot save twice.
 */
export function settlePress<T>(press: PressKey, r: Outcome<T>): { ok: true; value: T } | { ok: false; message: string; checkRecord: boolean } {
  if (r.ok) {
    press.settle(null);
    return r;
  }
  press.settle(r.failure);
  if (mayAlreadyBeSaved(r.failure)) {
    press.reset();
    return { ok: false, message: IN_PROGRESS_WORDS, checkRecord: true };
  }
  const again = sameKeyMayRetry(r.failure) ? ' Press again to retry — the same press is never saved twice.' : '';
  return { ok: false, message: r.failure.message + again, checkRecord: false };
}

// ── Dates: typed and shown as "14 Nov 2026" (Yasir's date standard) ─────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Nov 1995", "14 november 1995", "14/11/1995" → "1995-11-14"; anything else → null. */
export function parseHouseDate(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  let d: number, m: number, y: number;
  const named = /^(\d{1,2})[ -]([A-Za-z]{3,9})\.?[ -](\d{4})$/.exec(t);
  const slashed = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(t);
  if (named) {
    d = Number(named[1]);
    const idx = MONTHS.findIndex((x) => named[2].toLowerCase().startsWith(x.toLowerCase()));
    if (idx < 0) return null;
    m = idx + 1;
    y = Number(named[3]);
  } else if (slashed) {
    d = Number(slashed[1]);
    m = Number(slashed[2]);
    y = Number(slashed[3]);
  } else return null;
  const ymd = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isValidDateStr(ymd) ? ymd : null;
}

/** "1995-11-14" → "14 Nov 1995". */
export function houseDay(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return '';
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// ── The AMS's own helpers, copied (money.check runs the originals beside them) ──

/** lib/dates.js toDateStr. */
export function toDateStr(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** lib/dates.js isValidDateStr. */
export function isValidDateStr(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export const MIN_INSTALLMENTS = 2;
export const MAX_INSTALLMENTS = 36;

/** lib/installments.js splitNetIntoInstallments: equal parts in fils, the remainder on the last. */
export function splitNetIntoInstallments(netFee: number | string, count: number | string): string[] {
  const n = parseInt(String(count), 10);
  if (!Number.isFinite(n) || n < 1) return [];
  const netFils = Math.round((parseFloat(String(netFee)) || 0) * 1000);
  const baseFils = Math.floor(netFils / n);
  const lastFils = netFils - baseFils * (n - 1);
  return Array.from({ length: n }, (_, i) => ((i === n - 1 ? lastFils : baseFils) / 1000).toFixed(3));
}

/** lib/installments.js validateInstallmentCount (an enrolment: at least 2). */
export function validateInstallmentCount(value: unknown): string | null {
  const min = MIN_INSTALLMENTS;
  const range = 'between ' + min + ' and ' + MAX_INSTALLMENTS;
  if (value === null || value === undefined || String(value).trim() === '') {
    return 'Please enter the number of installments (a whole number ' + range + ').';
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return '"' + String(value) + '" is not a number of installments. Enter a whole number ' + range + '.';
  if (!Number.isInteger(n)) return 'The number of installments must be a whole number, not ' + n + '.';
  if (n < min || n > MAX_INSTALLMENTS) return 'The number of installments must be ' + range + ' (you entered ' + n + ').';
  return null;
}

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** utils/constants.js normalizeDays: canonical "Sun, Mon, Tue", weekday-ordered. */
export function normalizeDays(input: string[] | string | null | undefined): string {
  if (!input) return '';
  const tokens = (Array.isArray(input) ? input : String(input).split(','))
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  const matched: string[] = [];
  DAYS.forEach((short, idx) => {
    if (tokens.some((t) => t === short.toLowerCase() || t === LONG_DAYS[idx].toLowerCase())) matched.push(short);
  });
  return matched.join(', ');
}

export type PaymentPlan = {
  payment_type: '' | 'full' | 'installments';
  installments: string;
  installment_interval: 'monthly' | 'weekly';
  paid_now: string;
  payment_method_id: string;
  method_branch_id: string;
  proof_url?: string | null;
  reference_no?: string;
  transaction_date?: string;
};

/** enrollmentFlow toPaidNow: a typed "paid now" IS the instruction to record it. */
export function toPaidNow(payment: Pick<PaymentPlan, 'paid_now'> | null | undefined): number {
  return payment?.paid_now !== '' && payment?.paid_now != null ? parseFloat(payment.paid_now) || 0 : 0;
}

/** enrollmentFlow buildInstallmentItems (no custom dates in the app). */
export function buildInstallmentItems(args: {
  netFee: number;
  numInstallments: number;
  interval: 'monthly' | 'weekly';
  customDates?: string[];
  dueDateBase?: string;
}): { installment_no: number; scheduled_amount: string; due_date: string }[] {
  const { netFee, numInstallments: n, interval, customDates = [], dueDateBase } = args;
  const amounts = splitNetIntoInstallments(netFee, n);
  return Array.from({ length: n }, (_, i) => {
    const dueDate =
      customDates[i] ||
      (() => {
        const d = dueDateBase ? new Date(dueDateBase) : new Date();
        if (interval === 'monthly') d.setMonth(d.getMonth() + i);
        else d.setDate(d.getDate() + i * 7);
        return toDateStr(d) as string;
      })();
    return { installment_no: i + 1, scheduled_amount: amounts[i], due_date: dueDate };
  });
}

/** enrollmentFlow validateEnrollment, as the website's enrol screens call it (schedule fields and a plan required). */
export function validateEnrollment(a: {
  courseId: string;
  selectedScheduleId: string | null;
  hoursPerSession: string;
  teacherId: string | null;
  startDate: string;
  days: string[];
  payment: PaymentPlan;
}): string | null {
  if (!a.courseId) return 'Please select a course';
  if (!a.startDate || !String(a.startDate).trim()) return 'Start date is required — when do classes begin?';
  if (!isValidDateStr(String(a.startDate).trim())) return 'Start date is not a valid date';
  if (!a.selectedScheduleId) {
    if (!a.hoursPerSession || parseFloat(a.hoursPerSession) <= 0) return 'Hours per session is required when no batch is selected';
    if (!a.teacherId) return 'Please select a teacher when no batch is selected';
    if (a.days.length === 0) return 'Please choose the class days when no batch is selected';
  }
  const p = a.payment;
  if (!p.payment_type) return 'Please choose a payment type (Full or Installments)';
  if (!p.method_branch_id) return 'Please choose a pay branch';
  const pn = toPaidNow(p);
  if (pn < 0) return 'Paid now cannot be negative';
  if (pn > 0 && !p.payment_method_id) return 'Please choose a payment method for the amount paid now';
  if (p.payment_type === 'installments') {
    const countError = validateInstallmentCount(p.installments);
    if (countError) return countError;
  }
  return null;
}

/** enrollmentFlow validatePayment. */
export function validatePayment(a: { amount: string; paymentMethodId: string; requiresProof: boolean; proofUrl: string | null }): string | null {
  const amt = parseFloat(a.amount);
  if (isNaN(amt) || amt <= 0) return 'Amount must be greater than zero';
  if (!a.paymentMethodId) return 'Please select a payment method';
  if (a.requiresProof && !a.proofUrl) return 'Please upload a proof of payment for this method';
  return null;
}

/** A class time as typed — "4:30 PM", "4 pm", "16:30" — to the AMS's "16:30"; anything else → null. */
export function parseClock(text: string): string | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text.trim().toLowerCase());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    if (m[3] === 'pm' && h !== 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
  } else if (m[2] === undefined || h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ── Enrol: the body of POST /enrollments/full, as runEnrollmentFull builds it ──

export type DeliveryMode = 'face_to_face' | 'online' | 'hybrid';
export const DELIVERY_MODES: { value: DeliveryMode; label: string }[] = [
  { value: 'face_to_face', label: 'Face to face' },
  { value: 'online', label: 'Online' },
  { value: 'hybrid', label: 'Hybrid' },
];

export type EnrolInput = {
  studentId: string;
  courseId: string;
  selectedScheduleId: string | null;
  branchId: string | null;
  enrolledDate: string;
  startDate: string | null;
  deliveryMode: DeliveryMode;
  teacherId: string | null;
  chips: { days: string[]; startTime: string; endTime: string; hoursPerSession: string };
  courseFee: number | string | null;
  payment: PaymentPlan;
};

/**
 * The body, and — exactly as runEnrollmentFull reports it — an amount typed
 * with no method, which the plan then does not claim. No discount and no
 * coupon in the app: those stay on the website.
 */
export function enrolBody(i: EnrolInput, dueDateBase?: string): { body: Record<string, unknown>; paymentError: string | null } {
  const picked = i.selectedScheduleId || null;
  const body: Record<string, unknown> = {
    student_id: i.studentId,
    course_id: i.courseId,
    schedule_id: picked,
    branch_id: i.branchId || null,
    enrolled_date: i.enrolledDate,
    start_date: i.startDate || null,
    assigned_teacher_id: i.teacherId || null,
    hours_per_session: i.chips.hoursPerSession ? parseFloat(i.chips.hoursPerSession) : null,
    class_days: picked ? null : normalizeDays(i.chips.days || []) || null,
    class_start_time: picked ? null : i.chips.startTime || null,
    class_end_time: picked ? null : i.chips.endTime || null,
  };
  body.delivery_mode = i.deliveryMode;
  let paymentError: string | null = null;
  if (i.courseFee != null) {
    const fee = parseFloat(String(i.courseFee));
    const discount = 0;
    const netFee = Math.max(0, fee - discount);
    const p = i.payment;
    const numInstallments = p.payment_type === 'full' ? 1 : parseInt(p.installments) || 1;
    const paidNow = toPaidNow(p);
    const missingMethod = paidNow > 0 && !p.payment_method_id;
    body.plan = {
      gross_amount: fee,
      discount,
      net_amount: netFee,
      upfront_amount: missingMethod ? 0 : paidNow,
      items: buildInstallmentItems({ netFee, numInstallments, interval: p.installment_interval, dueDateBase }),
      notes: null,
      coupon_code: undefined,
    };
    if (missingMethod) {
      paymentError = 'No payment method was chosen, so the KD ' + paidNow.toFixed(3) + ' was not recorded. The plan shows nothing paid upfront.';
    } else if (paidNow > 0) {
      body.payment = {
        amount: paidNow,
        payment_method_id: p.payment_method_id,
        proof_url: p.proof_url || null,
        reference_no: p.reference_no,
        transaction_date: p.transaction_date,
        notes: null,
      };
    }
  }
  return { body, paymentError };
}

// ── Take a payment: the body of POST /payments, as postPayment builds it ────

export function paymentBody(a: {
  studentId: string;
  enrollmentId: string;
  amount: string;
  paymentMethodId: string;
  proofUrl: string | null;
  referenceNo?: string;
  transactionDate?: string;
  notes?: string;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    student_id: a.studentId,
    enrollment_id: a.enrollmentId || null,
    amount: Number(a.amount).toFixed(3),
    payment_method_id: a.paymentMethodId,
    proof_url: a.proofUrl || null,
    notes: a.notes || null,
  };
  if (a.referenceNo !== undefined) payload.reference_no = a.referenceNo || null;
  if (a.transactionDate !== undefined) payload.transaction_date = a.transactionDate || null;
  return payload;
}

// ── Payment methods: a branch's own (the website's "pay branch") ────────────

export type Method = { id: string; branch_id: string | null; name: string; is_active: boolean; requires_proof: boolean; requires_reference: boolean };

/** GET /payment-methods for one branch, active only — the website's methodsForBranch. */
export function methodsPath(branchId: string): string {
  return `${MONEY_API.methods.path}?is_active=true&branch_id=${encodeURIComponent(branchId)}`;
}

export function methodById(all: Method[] | null | undefined, id: string): Method | null {
  return (all ?? []).find((m) => m.id === id) ?? null;
}

// ── Register: the body of POST /students ────────────────────────────────────

export type RegisterForm = {
  full_name: string;
  national_id: string;
  date_of_birth: string; // as typed, "14 Nov 1995"
  nationality: string;
  gender: '' | 'Female' | 'Male';
  country_of_residence: string;
  phone: string;
  whatsapp: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  address: string;
};

export const EMPTY_REGISTER: RegisterForm = {
  full_name: '',
  national_id: '',
  date_of_birth: '',
  nationality: '',
  gender: '',
  country_of_residence: 'Kuwait',
  phone: '',
  whatsapp: '',
  email: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  address: '',
};

/** The website's two picker lists, from the one dataset (utils/constants.js). The "---" separator is left out on a phone. */
export const NATIONALITIES: string[] = (buildList('demonym', PRIORITY_NATIONALITY_CODES) as string[]).filter((x) => x !== '---');
export const COUNTRIES: string[] = (buildList('name', PRIORITY_COUNTRY_CODES) as string[]).filter((x) => x !== '---');

/** lib/phonePrefix.js dialPrefix: "+965 " for Kuwait, '' for Other or unknown. */
export function dialPrefix(countryName: string): string {
  const c = (COUNTRY_DATA as { name: string; dial: string }[]).find((x) => x.name.toLowerCase() === String(countryName || '').trim().toLowerCase());
  return c ? '+' + c.dial + ' ' : '';
}

/** lib/phonePrefix.js isPrefixOnly: a box holding only a dial prefix is empty. */
export function isPrefixOnly(value: string | null | undefined, prefix: string): boolean {
  const v = String(value == null ? '' : value).trim();
  if (!v) return true;
  if (prefix && v === String(prefix).trim()) return true;
  const compact = v.replace(/[\s-]/g, '');
  return /^\+\d+$/.test(compact) && (DIAL_CODES as Set<string>).has(compact.slice(1));
}

/** The AMS's required fields (createStudent), in its order and its words. */
export const REGISTER_REQUIRED: readonly (readonly [keyof RegisterForm | 'branch_id', string])[] = [
  ['full_name', 'Full name'],
  ['phone', 'Phone'],
  ['branch_id', 'Branch'],
  ['national_id', 'National ID'],
  ['date_of_birth', 'Date of birth'],
  ['nationality', 'Nationality'],
  ['country_of_residence', 'Country of residence'],
  ['email', 'Email'],
];

/**
 * The body the website sends (StudentNew's createPayload, without photos,
 * area, marketer or lead — those stay on the website). An optional phone box
 * holding only the prefix is sent empty, as the website does. No joining
 * date: the AMS stores today.
 */
export function registerBody(f: RegisterForm, branchId: string): { body: Record<string, string>; problem: string | null } {
  const dob = parseHouseDate(f.date_of_birth);
  const body: Record<string, string> = {
    full_name: f.full_name.trim(),
    national_id: f.national_id.trim(),
    date_of_birth: dob ?? '',
    nationality: f.nationality,
    gender: f.gender,
    country_of_residence: f.country_of_residence,
    phone: f.phone.trim(),
    whatsapp: f.whatsapp.trim(),
    email: f.email.trim(),
    emergency_contact_name: f.emergency_contact_name.trim(),
    emergency_contact_phone: f.emergency_contact_phone.trim(),
    address: f.address.trim(),
    branch_id: branchId,
  };
  const prefix = dialPrefix(f.country_of_residence);
  if (isPrefixOnly(body.phone, prefix)) body.phone = '';
  for (const k of ['whatsapp', 'emergency_contact_phone'] as const) if (isPrefixOnly(body[k], prefix)) body[k] = '';
  if (f.date_of_birth.trim() && !dob) return { body, problem: 'Date of birth: type it as 14 Nov 1995.' };
  const missing = REGISTER_REQUIRED.filter(([k]) => !String(body[k] ?? '').trim()).map(([, label]) => label);
  if (missing.length) return { body, problem: missing.join(', ') + (missing.length === 1 ? ' is required' : ' are required') };
  return { body, problem: null };
}

/** GET /students/duplicate-check — by email and phone, as the website asks before saving. */
export function duplicatesPath(email: string, phone: string): string | null {
  const e = email.trim().toLowerCase();
  const digits = phone.replace(/\D/g, '');
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
  if (!emailOk && digits.length < 8) return null;
  const q = new URLSearchParams();
  if (emailOk) q.set('email', e);
  if (digits.length >= 8) q.set('phone', digits);
  return `${MONEY_API.duplicates.path}?${q.toString()}`;
}

export type DuplicateMatch = { id?: string; student_code: string; full_name: string; branch_name: string | null; in_scope: boolean };

// ── The fee summary: what is left, and the next instalment ──────────────────

export type SummaryItem = { id: string; installment_no: number; due_date: string; scheduled_amount: string | number; paid_amount: string | number; status: string };
export type SummaryEnrolment = {
  enrollment_id: string;
  enrollment_no: string | null;
  course_name: string | null;
  status: string | null;
  net_amount: string;
  total_paid: string;
  balance: string;
  schedules: { items: SummaryItem[] }[];
};
export type Summary = { enrollments: SummaryEnrolment[]; balance_overall: string };

/** Enrolments that still owe money, as the AMS computes the balance. */
export function owing(s: Summary | null | undefined): SummaryEnrolment[] {
  return (s?.enrollments ?? []).filter((e) => Number(e.balance) > 0.0005);
}

/** The next instalment not paid, and what is left of it (the mockup's "Instalment 3 · 90.000"). */
export function nextInstalment(e: SummaryEnrolment | null | undefined): { no: number; left: string; due: string } | null {
  const items = (e?.schedules ?? []).flatMap((s) => s.items ?? []).sort((a, b) => a.installment_no - b.installment_no);
  const it = items.find((x) => x.status !== 'paid');
  if (!it) return null;
  const left = Number(it.scheduled_amount) - Number(it.paid_amount || 0);
  return left > 0.0005 ? { no: it.installment_no, left: left.toFixed(3), due: it.due_date } : null;
}

// ── The receipt ─────────────────────────────────────────────────────────────

/** The name the AMS gives the PDF: "ICSA receipt EN-021001 14 Nov 2026.pdf". */
export function receiptFileName(enrollmentNo: string | null, todayYmd: string): string {
  const no = (enrollmentNo ?? '').replace(/[^A-Za-z0-9-]/g, '') || 'enrolment';
  return `ICSA receipt ${no} ${houseDay(todayYmd)}.pdf`;
}

/** The receipt render can take a while on the server (a headless browser) — up to ~45 s (docs/07). */
export const RECEIPT_WAIT_MS = 60_000;
