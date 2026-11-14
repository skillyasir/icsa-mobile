// Marketers, bunch 2 (14 Nov 2026): Follow-ups, New and Referrals — the three
// boards Yasir approved on 14 Nov 2026 (canvas "ICSA App — Marketers mockups
// (bunch 2)"). Pure — no React Native — so more.check.ts holds it to the AMS's
// routes and controllers and to the website's own coupon message and referral
// order.
//
// Yasir's rulings for this bunch:
//   - 14 Nov 2026: staff never type a lead in — a lead comes from a source (a
//     form someone filled, a coupon given). New has no "Add a lead".
//   - 14 Nov 2026: the target is an enrolment count, no KD.
//   - 8 Nov 2026: a marketer is never sent a student's money (the AMS leaves
//     fee, paid and balance out of her referrals; nothing here draws them).

import { inDates, narrow, rangeFor } from '../vendor/ams/referrals.ts';

import { waNumber } from '../teacher/students.ts';

import { LEADS_API } from './leads.ts';

export const MORE_API = {
  rewardsMine: { method: 'GET', path: '/rewards/mine' },
  checkRecipient: { method: 'POST', path: '/rewards/codes/check' },
  issueCode: { method: 'POST', path: '/rewards/codes' },
  markShared: { method: 'POST', path: '/rewards/codes/:id/shared' },
  links: { method: 'GET', path: '/referrals/links' },
  newLink: { method: 'POST', path: '/referrals/links' },
  linkCourses: { method: 'GET', path: '/referrals/link-courses' },
  referrals: { method: 'GET', path: '/referrals' },
  referralsPdf: { method: 'POST', path: '/referrals/pdf' },
  target: { method: 'GET', path: '/marketer-targets/my-progress' },
} as const;

// ── Follow-ups: the AMS's own schedule buckets (prospectFilter FU_VALUES) ────

export type Bucket = 'overdue' | 'today' | 'week';
export const BUCKETS: { value: Bucket; label: string }[] = [
  { value: 'overdue', label: 'OVERDUE' },
  { value: 'today', label: 'TODAY' },
  { value: 'week', label: 'THIS WEEK' },
];

/** One bucket of her leads to call — the AMS decides which lead is in which. */
export function bucketPath(b: Bucket): string {
  return `${LEADS_API.list.path}?fu=${b}&page=1&page_size=50`;
}

// ── WhatsApp, as the website opens it (lib/waLink.js) ────────────────────────

/** waLink.waUrl: a lead's chat, opened with the website's greeting. */
export function waUrl(phone: string | null | undefined, name: string | null | undefined): string | null {
  const digits = waNumber(phone);
  if (!digits) return null;
  const greeting = `Hi ${(name || '').trim().split(/\s+/)[0] || 'there'}, thanks for your interest in ICSA. How can I help?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}

/** waLink.waShareUrl: a prepared message to a number (or to anyone, with no number). */
export function waShareUrl(text: string, phone: string | null | undefined): string {
  const digits = waNumber(phone);
  return `https://wa.me/${digits || ''}?text=${encodeURIComponent(text || '')}`;
}

// ── New › Give a coupon ─────────────────────────────────────────────────────

export type CouponCourse = { id: string; name: string };
export type IssuedCoupon = { id: string; code: string; discount_amount: number | string; valid_until: string | null; course_name: string | null; to_name: string | null; to_phone: string | null };

/** The body of POST /rewards/codes for someone new (the AMS makes or links her lead). */
export function couponBody(a: { name: string; phone: string; courseId: string | null }): { ok: true; body: Record<string, string> } | { ok: false; message: string } {
  const name = a.name.trim();
  const phone = a.phone.trim();
  if (!name || !phone) return { ok: false, message: 'Their name and mobile are both needed.' };
  if (phone.replace(/\D/g, '').length < 8) return { ok: false, message: 'That phone number does not look right' };
  const body: Record<string, string> = { to_name: name, to_phone: phone };
  if (a.courseId) body.course_id = a.courseId;
  return { ok: true, body };
}

/** components/coupons/couponUi.js kdShort: "KD 5", "KD 2.5". */
export function kdShort(n: number | string | null | undefined): string {
  return 'KD ' + Number(n || 0).toFixed(3).replace(/\.?0+$/, '');
}

/** lib/couponTerms.js — the one terms line every coupon carries. */
export const COUPON_TERMS = 'Terms & conditions apply. This coupon is subject to approval and valid for selected courses only.';
/** lib/publicSite.js */
export const PUBLIC_SITE = 'https://icsa.us';

/**
 * The message the website sends with a code (couponUi.js shareText), line for
 * line: the voucher card's address is on the AMS (`origin` = the AMS site).
 */
export function shareText(a: { code: string; discount: number | string; validUntil: string | null; course: string | null; firstName: string | null; id: string | null; origin: string; day: (v: string) => string }): string {
  const off = kdShort(a.discount);
  const lines: (string | null)[] = [
    'Hi' + (a.firstName ? ' ' + a.firstName : '') + '! Here is ' + off + ' off your first course at ICSA.',
    a.id ? '' : null,
    a.id ? 'Your voucher: ' + a.origin + '/api/coupons/' + a.id + '/card?p=tall' : null,
    '',
    'Your code: ' + a.code,
    a.course ? 'For: ' + a.course : null,
    a.validUntil ? 'Valid until ' + a.day(a.validUntil) : null,
    '',
    'Show this code at the front desk when you enrol, or see our courses: ' + PUBLIC_SITE,
    '',
    COUPON_TERMS,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export type RewardsMine = {
  stats: { issued_month: number; used_month: number; used_all: number; issued_all: number };
  wallet: { balance: number; pending: number };
  courses: CouponCourse[];
};

// ── New › Share your lead link ──────────────────────────────────────────────

export type LeadLink = { id: string; token: string; course_label: string | null; clicks: number | null; submissions: number | string; enrolled: number | string; is_active: boolean };

/** The address a lead link opens (MyLinks.js: "https://icsa.us/apply?ref=" + token). */
export function linkUrl(token: string): string {
  return 'https://icsa.us/apply?ref=' + token;
}

/**
 * "12 form submits · 9 leads created" — the AMS's counts, in the website's
 * words (MyLinks.js). `clicks` counts FORM SUBMISSIONS, not opens: nothing in
 * the AMS counts opens (referralsController, submitProspect). The approved board
 * said "opens"; that was wrong, and the app says what the number is.
 */
export function linkLine(l: LeadLink): string {
  const subs = Number(l.clicks ?? 0);
  const leads = Number(l.submissions || 0);
  return `${subs} form submit${subs === 1 ? '' : 's'} · ${leads} lead${leads === 1 ? '' : 's'} created`;
}

// ── Referrals: the target, as an enrolment count (Yasir, 14 Nov 2026) ───────

type TargetRow = { target_count: number | string | null };
export type TargetAnswer = { period_month: string | null; target_org_wide: TargetRow | null; targets_per_branch: TargetRow[]; actual_count: number };

/** "9 of 15 enrolments", or null when no target is set this month. The org-wide target first, else her branches'. */
export function targetOf(t: TargetAnswer | null | undefined): { done: number; of: number } | null {
  if (!t) return null;
  const org = t.target_org_wide && t.target_org_wide.target_count != null ? Number(t.target_org_wide.target_count) : null;
  const branches = (t.targets_per_branch ?? []).map((x) => Number(x.target_count ?? 0)).filter((n) => n > 0);
  const of = org ?? (branches.length ? branches.reduce((a, b) => a + b, 0) : null);
  if (!of) return null;
  return { done: Number(t.actual_count || 0), of };
}

/** Days left in the month (Kuwait's today, "YYYY-MM-DD"). */
export function daysLeftInMonth(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return last - d;
}

// ── Referrals: this month, in the website's order (lib/referrals.js) ────────

export type Referral = {
  id: string;
  student_name: string | null;
  course_name: string | null;
  enrollment_no: string | null;
  enrollment_status: string | null;
  student_status: string | null;
  attended: number | string | null;
  last_attended: string | null;
  referral_date: string | null;
  enrolled_date: string | null;
  status: string;
  created_at?: string;
  referrer_id?: string;
};

/** This month's referrals, numbered as the website and its PDF number them. */
export function thisMonth(all: Referral[] | null | undefined, today: string): { from: string; to: string; rows: Referral[] } {
  const [from, to] = rangeFor('month', today, undefined) as [string, string];
  const rows = narrow(inDates(all ?? [], { from, to, dateBy: 'referral', marketers: [] }), { status: 'all', q: '', dateBy: 'referral' }) as Referral[];
  return { from, to, rows };
}

/** The PDF job (referralsPdfController): this month, by referral date, every status. */
export function pdfBody(from: string, to: string): Record<string, string> {
  return { from, to, date_by: 'referral', status: 'all', q: '' };
}

/** "ICSA referrals 1 Nov 2026 – 30 Nov 2026.pdf" */
export function pdfName(from: string, to: string, day: (v: string) => string): string {
  return `ICSA referrals ${day(from)} – ${day(to)}.pdf`;
}
