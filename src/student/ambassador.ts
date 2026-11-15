// The Student Ambassador (Yasir, 15 Nov 2026: "most important… students can
// generate a coupon and send it through WhatsApp"; mockups approved that day).
// Pure — no React Native — so ambassador.check.ts holds it to the AMS's routes
// and the website's own page (client/src/pages/student/StudentAmbassador.js).
//
// The AMS decides everything: who may get a code (a friend with no history at
// ICSA, checked when the code is made), how many a student may make this month,
// the discount and the reward (the manager's rules), and the reward's journey —
// enrolled → waiting for payment → almost there → earned. A student sees a
// friend's PROGRESS, never their fee or payments (the AMS strips them).

import { kuwaitDay } from '../attendance/rules.ts';
import { COUPON_TERMS, PUBLIC_SITE, kdShort } from '../marketer/more.ts';
import { houseDay } from '../reception/money.ts';

export const AMBASSADOR_API = {
  me: { method: 'GET', path: '/ambassador/me' },
  issue: { method: 'POST', path: '/ambassador/vouchers' },
  shared: { method: 'POST', path: '/ambassador/shared' },
  // Public (no sign-in): the voucher's page, whose picture WhatsApp shows as the
  // link's preview, and the picture itself for the share sheet.
  card: { method: 'GET', path: '/coupons/:id/card' },
  image: { method: 'GET', path: '/coupons/:id/image' },
} as const;

export type Status = 'issued' | 'shared' | 'used' | 'waiting' | 'cooling' | 'earned' | 'refunded' | 'expired' | 'void' | 'live' | 'off' | 'review';

export type Code = {
  id: string;
  code: string;
  status: Status;
  origin: string | null;
  friend_name: string | null;
  friend_whatsapp: string | null;
  valid_until: string | null;
  shared_at: string | null;
  discount_amount: number | null;
  giver_kd: number | null;
  giver_reward_kd: number | null;
  receiver_name: string | null;
  earns_on_any: string | null;
  paid_pct: number | null;
};

export type WalletLine = { id: string; amount_kd: number; kind: string; note: string | null; created_at: string };

export type Mine = {
  name: string | null;
  rule: { discount?: number; reward_kd?: number } | null;
  cooling_days: number | null;
  allowance: { issued_this_month: number; cap: number; blocked: string | null } | null;
  wallet: { balance: number; pending: number; lines: WalletLine[] } | null;
  codes: Code[];
  /** The AMS's age rule for this student (AMS d9b15467): when not eligible, `allowance.blocked` carries its message too. */
  ambassador_age?: { eligible: boolean; reason: string | null; message: string | null } | null;
};

/** "15 Dec 2026" from a timestamp or a day, in Kuwait. */
export const day = (v: string | null | undefined): string => (v ? houseDay(kuwaitDay(v)) : '');

/** The website's status words (STATUS), and their tones in the app's palette. */
export const STATUS_WORD: Record<string, { label: string; tone: 'info' | 'muted' | 'warning' | 'success' | 'danger' }> = {
  issued: { label: 'Not used yet', tone: 'info' },
  shared: { label: 'Shared', tone: 'muted' },
  used: { label: 'Enrolled', tone: 'warning' },
  waiting: { label: 'Waiting for payment', tone: 'warning' },
  cooling: { label: 'Almost there', tone: 'info' },
  earned: { label: 'Earned', tone: 'success' },
  refunded: { label: 'Refunded', tone: 'danger' },
  expired: { label: 'Expired', tone: 'muted' },
  void: { label: 'Cancelled', tone: 'muted' },
};
export const statusOf = (c: Pick<Code, 'status'>) => STATUS_WORD[c.status] ?? STATUS_WORD.issued;

/** The website's KIND words for a reward-history line. */
export const LINE_KIND: Record<string, string> = { earn: 'Earned', clawback: 'Taken back', redeem: 'Spent', adjust: 'Adjusted', carry: 'Carried over', payout: 'Paid to you' };

/** The reward of one code: what it earned, else what it was issued with. */
export const rewardOf = (c: Pick<Code, 'giver_reward_kd' | 'giver_kd'>): number | null =>
  c.giver_reward_kd !== null && c.giver_reward_kd !== undefined ? c.giver_reward_kd : c.giver_kd;

const isOld = (c: Pick<Code, 'origin'>) => c.origin === 'old_system';

/** The code to share now: the newest not yet used (never one made from an old-system referral). */
export const currentCode = (codes: readonly Code[]): Code | null => codes.find((c) => !isOld(c) && (c.status === 'issued' || c.status === 'shared')) ?? null;

/** My friends: every code someone used, or that went anywhere (the website's filter). */
export const friendsOf = (codes: readonly Code[]): Code[] => codes.filter((c) => !!c.receiver_name || c.status !== 'issued' || isOld(c));

export const friendName = (c: Code): string => c.receiver_name || c.friend_name || c.code;
export const fromOldSystem = isOld;

/** The website's line under a friend's name, word for word. */
export function friendLine(c: Code, coolingDays: number | null | undefined): string {
  const r = kdShort(rewardOf(c));
  if (c.status === 'earned') return `${r} earned`;
  if (c.status === 'cooling') return `Paid enough ✓ — your ${r} arrives ${day(c.earns_on_any)}`;
  if (c.status === 'waiting') {
    const start = c.paid_pct ? `Paid ${Math.min(100, c.paid_pct)}% of what's needed — your ` : 'Waiting for their first payment — your ';
    return `${start}${r} comes ${coolingDays || 0} days after they reach it`;
  }
  if (c.status === 'used') return `${r} after their first payment`;
  if (c.status === 'shared') return `Code shared ${day(c.shared_at)} · not used yet`;
  if (c.status === 'expired') return `Expired ${day(c.valid_until)}`;
  if (isOld(c)) return `Code ${c.code} · valid until ${day(c.valid_until)} · not used yet`;
  return c.code;
}

/** A waiting friend's bar: how much of the minimum is paid (never the amounts). */
export const progressPct = (c: Pick<Code, 'status' | 'paid_pct'>): number | null =>
  c.status === 'waiting' ? Math.max(2, Math.min(100, c.paid_pct || 0)) : null;

/** The soonest reward on its way (the hero's line), or none. */
export function soonest(codes: readonly Code[]): Code | null {
  const s = codes.filter((c) => c.status === 'cooling').sort((x, y) => String(x.earns_on_any).localeCompare(String(y.earns_on_any)));
  return s[0] ?? null;
}

/** "Give a friend KD 10 off — you get KD 10 when they join and pay." */
export const offerLine = (m: Pick<Mine, 'rule'>): string =>
  `Give a friend ${kdShort(m.rule?.discount)} off — you get ${kdShort(m.rule?.reward_kd)} when they join and pay.`;

/** The voucher's page: WhatsApp shows the voucher picture as the link's preview. */
export const cardUrl = (origin: string, id: string): string => `${origin}/api/coupons/${id}/card?p=tall`;

/** The voucher picture for the share sheet: Status size, as the website shares it. */
export const imageUrl = (origin: string, id: string): string => `${origin}/api/coupons/${id}/image?v=3&size=story`;

/** The website's message (StudentAmbassador.js shareMessage), line for line. */
export function shareMessage(c: Pick<Code, 'id' | 'code' | 'friend_name' | 'discount_amount' | 'valid_until'>, origin: string): string {
  const first = (c.friend_name || '').trim().split(/\s+/)[0];
  return (
    'Hi' + (first ? ' ' + first : '') + "! I'm studying at ICSA and you can get " + kdShort(c.discount_amount) +
    ' off your first course.\n\nYour voucher: ' + cardUrl(origin, c.id) +
    '\n\nYour code: ' + c.code +
    (c.valid_until ? '\nValid until ' + day(c.valid_until) : '') +
    '\n\nShow it at the front desk when you enrol, or see the courses: ' + PUBLIC_SITE +
    '\n\n' + COUPON_TERMS
  );
}

/** "For Sara Ahmed · 9876 5432 · valid until 15 Dec 2026". */
export function codeFor(c: Pick<Code, 'friend_name' | 'friend_whatsapp' | 'valid_until'>): string {
  const who = c.friend_name || c.friend_whatsapp ? 'For ' + [c.friend_name, c.friend_whatsapp].filter(Boolean).join(' · ') : "For anyone who isn't an ICSA student yet";
  return who + (c.valid_until ? ' · valid until ' + day(c.valid_until) : '');
}

/** The body of a new code: the friend's name and WhatsApp, both required (the code is locked to the number). */
export function issueBody(name: string, phone: string): { ok: true; body: { friend_name: string; friend_whatsapp: string } } | { ok: false; message: string } {
  if (!name.trim()) return { ok: false, message: "Enter your friend's name" };
  if (phone.replace(/\D/g, '').length < 8) return { ok: false, message: "Enter your friend's WhatsApp number (8 digits)" };
  return { ok: true, body: { friend_name: name.trim(), friend_whatsapp: phone.trim() } };
}

/** "Create code for Noor". */
export const createLabel = (name: string): string => 'Create code' + (name.trim() ? ' for ' + name.trim().split(/\s+/)[0] : '');

/** "Codes this month: 1 of 5". */
export const monthLine = (a: Mine['allowance']): string => `Codes this month: ${a?.issued_this_month || 0} of ${a?.cap || 0}`;

/** A reward-history line: "8 Nov 2026 · Earned — note", "+ KD 10". */
export function historyLine(l: WalletLine): { left: string; right: string; minus: boolean } {
  const minus = l.amount_kd < 0;
  return {
    left: `${day(l.created_at)} · ${LINE_KIND[l.kind] ?? l.kind}${l.note ? ' — ' + l.note : ''}`,
    right: (minus ? '− ' : '+ ') + kdShort(Math.abs(l.amount_kd)),
    minus,
  };
}

/** The footnote, as the website says it. */
export const footnote = (coolingDays: number | null | undefined): string =>
  `Your reward is earned ${coolingDays ? coolingDays + ' days ' : ''}after your friend has paid enough on their course. A refund takes it back. We never show your friend's fee or payments — only the progress.`;

/**
 * Home's card. With the programme's answer: the offer and what you earned.
 * Without it (still loading, or the AMS refused): the website's own card words,
 * so the way in is always there and the screen says what is wrong.
 */
export function homeCard(m: Pick<Mine, 'rule' | 'wallet'> | null | undefined): { title: string; sub: string; earned: string | null } {
  const discount = Number(m?.rule?.discount) || 0;
  const reward = Number(m?.rule?.reward_kd) || 0;
  return {
    title: discount > 0 ? `Give a friend ${kdShort(discount)} off` : 'Ambassador programme',
    sub: reward > 0 ? `You get ${kdShort(reward)} when they join and pay.` : 'Invite a friend — they save on their first course',
    earned: m?.wallet ? kdShort(m.wallet.balance) : null,
  };
}

// ── Adults only (Yasir, 15 Nov 2026) ────────────────────────────────────────
// The Ambassador is for students aged 18 and over, and a student with no date
// of birth on file is not offered it — the AMS's rule, in ONE place
// (services/ambassadorAge.js, AMS d9b15467). The app never works out an age,
// not even as a fallback: it reads the AMS's answer — the dashboard's
// `ambassador` for Home, `ambassador_age` on /ambassador/me for the screen —
// and shows the AMS's own words. (A test of its own, built that morning, was
// taken out the same day at the AMS chat's request.)

export type Eligibility = { eligible: boolean; reason: string | null; message: string | null };

/** Home offers the programme only when the AMS says so; loading, or not said, is not. */
export const homeOffers = (d: { ambassador?: Eligibility | null } | null | undefined): boolean => d?.ambassador?.eligible === true;

/** The screen: the AMS's answer, as the website reads it (no field — an older AMS — offers it). */
export const ageOf = (m: Pick<Mine, 'ambassador_age'> | null | undefined): Eligibility => m?.ambassador_age ?? { eligible: true, reason: null, message: null };
