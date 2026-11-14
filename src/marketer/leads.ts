// Marketers, bunch 1 (14 Nov 2026): My leads (mockup 13) and one lead (mockup
// 14), both approved 3 Nov 2026. Pure — no React Native — so leads.check.ts
// holds it to the AMS's own routes, controllers and the website's pickers.
//
// Yasir ruled, 14 Nov 2026: the app shows the AMS's stages only — New,
// Contacted, Enrolled, Lost (mockup 14 drew Interested and Visited, which the
// AMS does not have). The server decides: who may see a lead, its stage, its
// expiry and every count are the AMS's (enforceProspectScope, prospect_expiry,
// getProspects' counts); the phone only shows them. A marketer is never sent a
// student's money (studentMoney.seesStudentMoney, 8 Nov 2026).

import { expiryOf } from '../vendor/ams/leadExpiry.ts';

export const LEADS_API = {
  list: { method: 'GET', path: '/referrals/prospects' },
  one: { method: 'GET', path: '/referrals/prospects/:id' },
  activity: { method: 'GET', path: '/referrals/prospects/:id/activity' },
  log: { method: 'POST', path: '/referrals/prospects/:id/followup' },
  lostReasons: { method: 'GET', path: '/referrals/lost-reasons' },
} as const;

// ── Stages: the AMS's four (updateProspectStatus), in the website's words ────

export type Stage = 'new' | 'contacted' | 'enrolled' | 'lost';
export const STAGES: { value: Stage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'lost', label: 'Lost' },
];

/** The list's filter chips: all, then a stage (the AMS's ?stage=). */
export type StageFilter = 'all' | Stage;

/** GET /referrals/prospects, one page, the newest first, with the AMS's counts. */
export function listPath(stage: StageFilter, search: string | null, page = 1): string {
  const q = new URLSearchParams({ page: String(page), page_size: '50' });
  if (stage !== 'all') q.set('stage', stage);
  if (search) q.set('search', search);
  return `${LEADS_API.list.path}?${q.toString()}`;
}

export type Lead = {
  id: string;
  full_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  course_interest_name: string | null;
  branch_interest_name: string | null;
  referred_by_name: string | null;
  created_at: string;
  next_followup_date: string | null;
  last_contact_at: string | null;
  last_note: string | null;
  last_activity_at: string | null;
  is_contacted: boolean | null;
  wrong_number_at: string | null;
  lost_reason: string | null;
  attributed_enrollment_no: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  is_expired: boolean | null;
  followup_holds?: boolean | null;
  notes?: string | null;
  crs_number?: string | null;
};

export type ListAnswer = {
  prospects: Lead[];
  total: number;
  total_pages: number;
  page: number;
  counts: { stage: Record<string, number>; schedule: { overdue: number; today: number } };
};

/** The three figures over the list (mockup 13): the AMS's own counts, never the rows added up. */
export function headerFigures(a: ListAnswer | null): { value: number; label: string }[] {
  if (!a) return [];
  const s = a.counts?.stage ?? {};
  const sch = a.counts?.schedule ?? { overdue: 0, today: 0 };
  return [
    { value: Number(s.new ?? 0), label: 'new' },
    { value: Number(sch.today ?? 0) + Number(sch.overdue ?? 0), label: 'to call today' },
    { value: Number(s.enrolled ?? 0), label: 'enrolled' },
  ];
}

/** "All 31", "New 6"… — the chip counts are the AMS's. */
export function stageChips(a: ListAnswer | null): { value: StageFilter; label: string }[] {
  const s = a?.counts?.stage ?? {};
  const all = STAGES.reduce((n, x) => n + Number(s[x.value] ?? 0), 0);
  return [{ value: 'all', label: a ? `All ${all}` : 'All' }, ...STAGES.map((x) => ({ value: x.value, label: a ? `${x.label} ${Number(s[x.value] ?? 0)}` : x.label }))];
}

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'muted';

/** The line under a lead's name: where it stands and what is next (mockup 13's right-hand words). */
export function leadLine(p: Lead, today: string, day: (ymd: string) => string): { text: string; tone: Tone } {
  if (p.status === 'enrolled') return { text: p.attributed_enrollment_no ? `Enrolled · ${p.attributed_enrollment_no}` : 'Enrolled', tone: 'success' };
  if (p.status === 'lost') return { text: 'Lost', tone: 'muted' };
  if (p.status === 'enrolled_refunded') return { text: 'Enrolled · refunded', tone: 'muted' };
  const e = expiryOf(p) as { text: string; tone: string } | null;
  if (e && (e.tone === 'expired' || e.tone === 'urgent')) return { text: e.text === 'expired' ? 'Expired' : e.text[0].toUpperCase() + e.text.slice(1), tone: e.tone === 'expired' ? 'danger' : 'warning' };
  const due = p.next_followup_date ? p.next_followup_date.slice(0, 10) : null;
  if (due && due < today) return { text: `Call overdue since ${day(due)}`, tone: 'danger' };
  if (due && due === today) return { text: 'Call today', tone: 'warning' };
  if (p.status === 'new' && !p.is_contacted) return { text: 'New — not contacted', tone: 'info' };
  if (due) return { text: `Next call ${day(due)}`, tone: 'muted' };
  return { text: p.status === 'contacted' ? 'Contacted' : 'New', tone: 'muted' };
}

// ── Log a contact: the website's LogContactForm, word for word ──────────────

export const WRONG_NUMBER = 'Wrong WhatsApp / number';
export const OUTCOMES = ['Called - reached', 'Called - no answer', 'WhatsApp sent', WRONG_NUMBER, 'Visited', 'Other'] as const;
export const MOVES = [
  { value: 'move:enrolled', status: 'enrolled', label: '→ Move to Enrolled', outcome: 'Moved to Enrolled' },
  { value: 'move:lost', status: 'lost', label: '→ Move to Lost', outcome: 'Moved to Lost' },
] as const;
export const WHEN_OPTIONS = [
  { value: '1', label: 'Follow up tomorrow' },
  { value: '3', label: 'Follow up in 3 days' },
  { value: '7', label: 'Follow up next week' },
  { value: '14', label: 'Follow up in 2 weeks' },
  { value: 'pick', label: 'Pick a date' },
  { value: 'none', label: 'No follow-up date' },
] as const;
export type When = (typeof WHEN_OPTIONS)[number]['value'];

/** A Kuwait date "YYYY-MM-DD" plus n days. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * The body of POST /prospects/:id/followup, as LogContactForm sends it: the
 * outcome (or the move's), the note (required — the form will not send without
 * one), the next follow-up date (none when the lead is moved to Enrolled or
 * Lost), the new stage, and the lost reason. Days are counted from KUWAIT's
 * today (the form counts from the browser's; in Kuwait the two are the same).
 */
export function logBody(a: { choice: string; note: string; when: When; picked: string | null; lostReason: string; today: string }):
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string } {
  const move = MOVES.find((m) => m.value === a.choice) ?? null;
  const newStage = move ? move.status : '';
  if (!a.note.trim()) return { ok: false, message: 'Write a short note — what was said.' };
  if (newStage === 'lost' && !a.lostReason) return { ok: false, message: 'Choose why the lead was lost.' };
  if (!move && !(OUTCOMES as readonly string[]).includes(a.choice)) return { ok: false, message: 'Choose what happened.' };
  let next: string | null = null;
  if (!newStage && a.when !== 'none') next = a.when === 'pick' ? a.picked : addDays(a.today, parseInt(a.when, 10));
  if (!newStage && a.when === 'pick' && !next) return { ok: false, message: 'Pick the follow-up date, or choose another option.' };
  const body: Record<string, unknown> = { outcome: move ? move.outcome : a.choice, note: a.note.trim(), next_followup_date: next, status: newStage || undefined };
  if (newStage === 'lost') body.lost_reason = a.lostReason;
  return { ok: true, body };
}

export type LostReason = { key: string; label: string; active?: boolean };
/** The reasons offered: the AMS's list, the switched-off ones left out (useLostReasons' `offered`). */
export function offeredReasons(all: LostReason[] | null | undefined): LostReason[] {
  return (all ?? []).filter((r) => r.active !== false);
}

export type ActivityRow = { id: string; event_type: string; note: string | null; created_at: string; actor_name: string | null };
