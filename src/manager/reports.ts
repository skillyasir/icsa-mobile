// Managers, bunch 2 (14 Nov 2026): Dashboard and Reports (Collections, Fees
// overdue) — the mockups approved by Yasir on 14 Nov 2026. Pure — no React
// Native — so reports.check.ts holds it to the AMS's own routes and
// controllers (dashboardController.getDashboard, reportsController
// getFinancialReport and getOverdueDetail, branchesController.getAllBranches).
//
// Every figure is the AMS's, never added up on the phone. The AMS scopes it:
// a manager sees every branch, or one when he names it (?branch_id=).
//
// Periods — Yasir, 14 Nov 2026: Today · This week · This month (no Year).
// ICSA's week is Friday to Wednesday; Thursday is off. The AMS has no week
// yet (asked in docs/10-app-asks-ams-dashboard-week.md), so the chips are the
// AMS's today and month until it does; the words for a week are ready.

import { formatWeekdayDay, kuwaitDay } from '../attendance/rules.ts';
import { houseDay } from '../reception/money.ts';
import { kdAmount, type Figure } from '../reception/rules.ts';

// ── The AMS endpoints ───────────────────────────────────────────────────────

export const REPORTS_API = {
  dashboard: { method: 'GET', path: '/dashboard' },
  branches: { method: 'GET', path: '/branches' },
  financial: { method: 'GET', path: '/reports/financial' },
  overdue: { method: 'GET', path: '/reports/overdue' },
} as const;

/** "/x?a=1&b=2" — a parameter that is null is left out (never "b=null"). */
function withQuery(base: string, params: Record<string, string | null>): string {
  const q = Object.entries(params)
    .filter((e): e is [string, string] => e[1] !== null && e[1] !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `${base}?${q}` : base;
}

// ── Branches ────────────────────────────────────────────────────────────────

/** Every branch: no branch_id at all, which the AMS reads as all of them for a manager. */
export const ALL = 'all';

export type Branch = { id: string; name: string };
/** The active branches (the AMS hides inactive ones unless asked). */
export const BRANCHES_ACTIVE = REPORTS_API.branches.path;

const branchParam = (branch: string): string | null => (branch === ALL ? null : branch);

export function branchChips(list: readonly Branch[] | null | undefined): { value: string; label: string }[] {
  return [{ value: ALL, label: 'All branches' }, ...(list ?? []).map((b) => ({ value: b.id, label: b.name }))];
}

export function branchLabel(list: readonly Branch[] | null | undefined, branch: string): string {
  if (branch === ALL) return 'All branches';
  return list?.find((b) => b.id === branch)?.name ?? 'One branch';
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export type Period = 'today' | 'week' | 'month';
/** Only periods the AMS answers: This week joins when the AMS has it (docs/10). */
export const PERIOD_CHIPS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'This month' },
];
const PERIOD_WORD: Record<Period, string> = { today: 'today', week: 'this week', month: 'this month' };
const isPeriod = (v: unknown): v is Period => v === 'today' || v === 'week' || v === 'month';

export function dashboardPath(period: Period, branch: string): string {
  return withQuery(REPORTS_API.dashboard.path, { period, branch_id: branchParam(branch) });
}

type Split = { id: string; name: string; value: number };
export type Breakdown = { total: number; branches: Split[] };
export type ManagerDashboard = {
  scope: { role: string; period: string; branch_id: string | null; branch_name: string | null };
  kpis: { collection_period: Breakdown; enrollments_period: Breakdown; live_attendance: Breakdown; outstanding: Breakdown };
  charts: { revenue_30day: { date: string; amount: number }[] };
};

export type Tile = Figure & { tone?: 'danger' };

/**
 * The four tiles. The period is the one the AMS says it answered for, so a
 * label never runs ahead of its figures. Check-ins are always today's, and
 * what is owed is always what is owed now — the AMS ignores the period there.
 */
export function dashboardTiles(d: ManagerDashboard | null, asked: Period): Tile[] {
  if (!d) return [];
  const when = PERIOD_WORD[isPeriod(d.scope?.period) ? d.scope.period : asked];
  return [
    { label: 'Collected', value: kdAmount(d.kpis.collection_period.total), sub: `KD ${when}` },
    { label: 'Enrolments', value: String(d.kpis.enrollments_period.total), sub: when },
    { label: 'Check-ins', value: String(d.kpis.live_attendance.total), sub: 'in class today' },
    { label: 'Outstanding', value: kdAmount(d.kpis.outstanding.total), sub: 'KD still owed', tone: 'danger' },
  ];
}

export type Bar = { id: string; name: string; amount: string; share: number };

/** Collected by branch, largest first; each bar's length is its share of the largest. */
export function branchBars(b: Breakdown | null | undefined): Bar[] {
  const rows = [...(b?.branches ?? [])].sort((x, y) => y.value - x.value || x.name.localeCompare(y.name));
  const max = Math.max(0, ...rows.map((r) => r.value));
  return rows.map((r) => ({ id: r.id, name: r.name, amount: kdAmount(r.value), share: max > 0 ? Math.max(0, r.value) / max : 0 }));
}

/** The branch bars are worth showing only across branches, and only when there is more than one. */
export function showBranchBars(d: ManagerDashboard | null): boolean {
  return !!d && d.scope?.branch_id === null && (d.kpis.collection_period.branches?.length ?? 0) > 1;
}

export type DayBar = { day: string; share: number; last: boolean };
export type DayChart = { bars: DayBar[]; from: string; to: string; best: { day: string; amount: string } | null; label: string };

/**
 * The AMS's last-30-days chart (charts.revenue_30day): one bar a day, the
 * newest last. It is the AMS's own series — net of refunds, and course
 * payments only when one branch is chosen — so its days are not set beside
 * the Collected tile; the caption names its best day instead.
 */
export function dayChart(rows: readonly { date: string; amount: number }[] | null | undefined, today: string): DayChart | null {
  const days = (rows ?? []).map((r) => ({ day: kuwaitDay(r.date) ?? '', amount: Number(r.amount) || 0 })).filter((r) => r.day);
  if (days.length === 0) return null;
  const max = Math.max(0, ...days.map((r) => r.amount));
  const top = days.reduce((a, r) => (r.amount > a.amount ? r : a), days[0]);
  const from = houseDay(days[0].day);
  const lastDay = days[days.length - 1].day;
  const to = lastDay === today ? 'Today' : houseDay(lastDay);
  return {
    bars: days.map((r, i) => ({ day: r.day, share: max > 0 ? Math.max(0, r.amount) / max : 0, last: i === days.length - 1 })),
    from,
    to,
    best: max > 0 ? { day: houseDay(top.day), amount: kdAmount(top.amount) } : null,
    label: `Collected each day, ${from} to ${to === 'Today' ? houseDay(lastDay) : to}`,
  };
}

/** "Saturday, 14 Nov 2026". */
export const dayHeading = (today: string): string => formatWeekdayDay(today);

// ── Reports › Collections ───────────────────────────────────────────────────

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n: number) => String(n).padStart(2, '0');

export type Month = { y: number; m: number }; // m is 1–12

export function monthOf(ymd: string): Month {
  const [y, m] = ymd.slice(0, 7).split('-').map(Number);
  return { y, m };
}

export function shiftMonth(mo: Month, delta: number): Month {
  const i = mo.y * 12 + (mo.m - 1) + delta;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

const sameMonth = (a: Month, b: Month) => a.y === b.y && a.m === b.m;

export type MonthRange = { from: string; to: string; title: string; sub: string; current: boolean };

/** A month's first day to its last — or to today, for this month. */
export function monthRange(mo: Month, today: string): MonthRange {
  const current = sameMonth(mo, monthOf(today));
  const last = new Date(Date.UTC(mo.y, mo.m, 0)).getUTCDate();
  const from = `${mo.y}-${pad2(mo.m)}-01`;
  const to = current ? today.slice(0, 10) : `${mo.y}-${pad2(mo.m)}-${pad2(last)}`;
  return { from, to, title: `${MONTH_NAMES[mo.m - 1]} ${mo.y}`, sub: `${houseDay(from)} – ${houseDay(to)}`, current };
}

/** Forward stops at this month: the AMS has nothing collected in the future. */
export const canGoNext = (mo: Month, today: string): boolean => {
  const now = monthOf(today);
  return mo.y * 12 + mo.m < now.y * 12 + now.m;
};

/** The AMS reads from_date and to_date here (defaultDateRange), not from and to. */
export function financialPath(r: Pick<MonthRange, 'from' | 'to'>, branch: string): string {
  return withQuery(REPORTS_API.financial.path, { from_date: r.from, to_date: r.to, branch_id: branchParam(branch) });
}

export type Financial = {
  period: { from: string; to: string };
  summary: { total_collected: string; total_pending: string; total_overdue: string; total_refunds: string; refund_count: number; total_transactions: number };
  by_method: { method_name: string; txn_count: number; total: string }[];
  by_month: { month: string; month_sort: string; total: string; count: number }[];
};

/** "412 payments · refunds KD 360.000" — refunds only when there were any. */
export function collectedLine(s: Financial['summary']): string {
  const n = Number(s.total_transactions) || 0;
  const pays = `${n} ${n === 1 ? 'payment' : 'payments'}`;
  return Number(s.refund_count) > 0 ? `${pays} · refunds KD ${kdAmount(s.total_refunds)}` : pays;
}

export type Row = { key: string; label: string; amount: string; count?: string };

/** By method, in the AMS's order (largest first). */
export function methodRows(f: Financial | null): Row[] {
  return (f?.by_method ?? []).map((r) => ({ key: r.method_name, label: r.method_name, amount: kdAmount(r.total), count: String(r.txn_count) }));
}

/** Month by month (the AMS's trailing twelve months), newest first; this month says it is not over. */
export function monthRows(f: Financial | null, today: string): Row[] {
  const now = today.slice(0, 7);
  return [...(f?.by_month ?? [])]
    .sort((a, b) => b.month_sort.localeCompare(a.month_sort))
    .map((r) => ({ key: r.month_sort, label: r.month_sort === now ? `${r.month} (to date)` : r.month, amount: kdAmount(r.total) }));
}

// ── Reports › Fees overdue ──────────────────────────────────────────────────

export function overduePath(branch: string): string {
  return withQuery(REPORTS_API.overdue.path, { branch_id: branchParam(branch) });
}

export type OverdueItem = {
  id: string;
  installment_no: number;
  balance_due: string;
  due_date: string;
  days_late: number;
  student_id: string;
  student_code: string | null;
  student_name: string | null;
  branch_name: string | null;
  enrollment_id: string | null;
  course_name: string | null;
  teacher_name: string | null;
};
export type OverdueAnswer = {
  overdue: OverdueItem[];
  pending: OverdueItem[];
  totals: { overdue_amount: string; overdue_count: number; pending_amount: string; pending_count: number };
};

export type Sort = 'late' | 'large';
export const SORT_CHIPS: { value: Sort; label: string }[] = [
  { value: 'late', label: 'Most late first' },
  { value: 'large', label: 'Largest first' },
];

/** A sorted copy; the AMS's list is never changed in place. */
export function sortOverdue(items: readonly OverdueItem[], sort: Sort): OverdueItem[] {
  const owed = (x: OverdueItem) => Number(x.balance_due) || 0;
  return [...items].sort((a, b) =>
    sort === 'large' ? owed(b) - owed(a) || b.days_late - a.days_late : b.days_late - a.days_late || owed(b) - owed(a),
  );
}

/** Over 30 days late is red; up to 30 is amber. */
export const lateTone = (days: number): 'danger' | 'warning' => (days > 30 ? 'danger' : 'warning');

export const daysLateWord = (n: number): string => (n === 1 ? '1 day' : `${n} days`);

export const instalmentsWord = (n: number): string => (n === 1 ? 'instalment' : 'instalments');

/** "Computer Secretarial · Mahboula · due 14 Sep 2026" — the branch only across branches. */
export function overdueLine(i: OverdueItem, showBranch: boolean): string {
  const due = houseDay(kuwaitDay(i.due_date));
  return [i.course_name, showBranch ? i.branch_name : null, due ? `due ${due}` : null].filter(Boolean).join(' · ');
}
