import { readFileSync } from 'node:fs';

import { declOf, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  ALL,
  BRANCHES_ACTIVE,
  PERIOD_CHIPS,
  REPORTS_API,
  SORT_CHIPS,
  branchBars,
  branchChips,
  branchLabel,
  canGoNext,
  collectedLine,
  dashboardPath,
  dashboardTiles,
  dayChart,
  dayHeading,
  financialPath,
  instalmentsWord,
  lateTone,
  methodRows,
  monthOf,
  monthRange,
  monthRows,
  overdueLine,
  overduePath,
  shiftMonth,
  showBranchBars,
  sortOverdue,
  type Financial,
  type ManagerDashboard,
  type OverdueItem,
} from './reports.ts';

// Managers, bunch 2 (14 Nov 2026): Dashboard and Reports, held to the AMS's
// routes (dashboard.js, reports.js, branches.js) and the controllers that
// answer them — the periods it knows, the parameter names it reads, the keys
// it sends, and where it splits overdue from not-yet-due.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const TODAY = '2026-11-14';
const dash = (over: Partial<ManagerDashboard['scope']> = {}, branches = [{ id: 'k', name: 'Kuwait City', value: 11200 }, { id: 'm', name: 'Mahboula', value: 6140 }]): ManagerDashboard => ({
  scope: { role: 'manager', period: 'month', branch_id: null, branch_name: null, ...over },
  kpis: {
    collection_period: { total: 17340, branches },
    enrollments_period: { total: 62, branches: [] },
    live_attendance: { total: 81, branches: [] },
    outstanding: { total: 9120.5, branches: [] },
  },
  charts: { revenue_30day: [] },
});
const item = (over: Partial<OverdueItem> = {}): OverdueItem => ({
  id: 'i', installment_no: 2, balance_due: '120.000', due_date: '2026-09-13T21:00:00.000Z', days_late: 61,
  student_id: 's', student_code: 'STU-1', student_name: 'Joel Reyes', branch_name: 'Mahboula', enrollment_id: 'e',
  course_name: 'Computer Secretarial', teacher_name: 'T', ...over,
});

run('reports.check — the manager Dashboard and Reports as the AMS answers them (Managers bunch 2)', (h) => {
  // §1 the routes, and that a manager may call each
  const idx = strip(readAmsFile('server/src/index.js'));
  const dr = strip(readAmsFile('server/src/routes/dashboard.js'));
  const rr = strip(readAmsFile('server/src/routes/reports.js'));
  const br = strip(readAmsFile('server/src/routes/branches.js'));
  h.check('§1 the three routers are mounted where the app calls them', /app\.use\('\/api\/dashboard', require\('\.\/routes\/dashboard'\)\)/.test(idx) && /app\.use\('\/api\/reports', require\('\.\/routes\/reports'\)\)/.test(idx) && /app\.use\('\/api\/branches', require\('\.\/routes\/branches'\)\)/.test(idx));
  h.check('§1 GET /dashboard: a manager may', /router\.get\('\/',\s*auth, authorize\('manager', [^)]*\), getDashboard\)/.test(dr));
  h.check('§1 GET /reports/financial and /reports/overdue: a manager may', /router\.get\('\/financial',\s*auth, authorize\('manager', [^)]*\), getFinancialReport\)/.test(rr) && /router\.get\('\/overdue',\s*auth, authorize\('manager', [^)]*\), getOverdueDetail\)/.test(rr));
  h.check('§1 GET /branches: any signed-in person', /router\.get\('\/',\s*auth,\s*getAllBranches\)/.test(br));
  h.check('§1 the app’s paths are those', REPORTS_API.dashboard.path === '/dashboard' && REPORTS_API.financial.path === '/reports/financial' && REPORTS_API.overdue.path === '/reports/overdue' && BRANCHES_ACTIVE === '/branches');

  // §2 the dashboard: its periods, its branch filter, and what it sends
  const dc = strip(readAmsFile('server/src/controllers/dashboardController.js'));
  const gd = declOf(dc, 'getDashboard');
  h.check('§2 getDashboard extracts (floor)', gd.length > 15000, String(gd.length));
  const valid = /const validPeriods = \[([^\]]*)\];/.exec(gd)?.[1] ?? '';
  const amsPeriods = valid.split(',').map((x) => x.trim().replace(/'/g, ''));
  h.check('§2 the AMS’s periods were read (floor: today and month)', amsPeriods.includes('today') && amsPeriods.includes('month'), valid);
  h.check('§2 every chip is a period the AMS answers (a week chip waits for docs/10)', PERIOD_CHIPS.every((c) => amsPeriods.includes(c.value)), `${PERIOD_CHIPS.map((c) => c.value).join()} vs ${amsPeriods.join()}`);
  h.check('§2 the chips are Yasir’s, in order, less any the AMS lacks (14 Nov 2026: Today · This week · This month)', PERIOD_CHIPS.map((c) => c.value).join() === ['today', 'week', 'month'].filter((p) => amsPeriods.includes(p)).join() && PERIOD_CHIPS.map((c) => c.label).join() === ['Today', 'This week', 'This month'].filter((_, i) => amsPeriods.includes(['today', 'week', 'month'][i])).join());
  h.check('§2 an unknown period is answered as month (so the screen labels what came back, not what it asked)', /: 'month';/.test(gd) && /period,\s*\n?\s*branch_id: scopedBranchId/.test(gd));
  h.check('§2 a manager’s branch is ?branch_id=, and none means every branch', /role === 'manager' \? \(req\.query\.branch_id \|\| null\) : null/.test(gd));
  h.check('§2 the path: period, then branch_id only for one branch', dashboardPath('month', ALL) === '/dashboard?period=month' && dashboardPath('today', 'b/1') === '/dashboard?period=today&branch_id=b%2F1');
  for (const k of ['collection_period', 'enrollments_period', 'live_attendance', 'outstanding']) {
    h.check(`§2 kpis.${k} is sent`, new RegExp(`\\b${k}: [a-zA-Z]+,`).test(gd));
  }
  h.check('§2 each breakdown is { total, branches: [{ id, name, value }] }', /return \{ total, branches: visible \};/.test(dc) && /return \{ id: b\.id, name: b\.name, value \};/.test(dc));
  h.check('§2 check-ins are today’s, physical only (period ignored)', /WHERE ar\.attendance_date = CURRENT_DATE\s+AND ar\.attendance_mode <> 'online'/.test(gd));
  h.check('§2 what is owed is owed now (period ignored)', /WHERE ii\.balance_due > 0\s+\$\{scopedBranchId \? 'AND e\.branch_id = \$1' : ''\}\s+GROUP BY e\.branch_id/.test(gd));
  h.check('§2 the chart is the last 30 days, one row a day', /generate_series\(0, 29\)/.test(gd) && /revenue_30day: revChartRes\.rows\.map/.test(gd));

  // §3 the dashboard on the phone
  const tiles = dashboardTiles(dash(), 'today');
  h.check('§3 four tiles, labelled for the period the AMS answered (not the one asked)', tiles.map((t) => `${t.label}=${t.value}/${t.sub}`).join('|') === 'Collected=17,340.000/KD this month|Enrolments=62/this month|Check-ins=81/in class today|Outstanding=9,120.500/KD still owed', tiles.map((t) => `${t.label}=${t.value}/${t.sub}`).join('|'));
  h.check('§3 a period the app does not offer, in the answer, falls back to the one asked', dashboardTiles(dash({ period: 'year' }), 'today')[0].sub === 'KD today');
  h.check('§3 a week answer is labelled this week (ready for docs/10)', dashboardTiles(dash({ period: 'week' }), 'month').map((t) => t.sub).slice(0, 2).join() === 'KD this week,this week');
  h.check('§3 Outstanding is the one red tile', tiles.filter((t) => t.tone === 'danger').map((t) => t.label).join() === 'Outstanding');
  const bars = branchBars({ total: 0, branches: [{ id: 'f', name: 'Future', value: 1300 }, { id: 'k', name: 'Kuwait City', value: 11200 }, { id: 'm', name: 'Mahboula', value: 6160 }] });
  h.check('§3 branch bars: largest first, the largest full length', bars.map((b) => `${b.name}:${b.share.toFixed(2)}`).join() === 'Kuwait City:1.00,Mahboula:0.55,Future:0.12' && bars[0].amount === '11,200.000', bars.map((b) => `${b.name}:${b.share.toFixed(2)}`).join());
  h.check('§3 all-zero branches draw no bar (never a divide by zero)', branchBars({ total: 0, branches: [{ id: 'a', name: 'A', value: 0 }] })[0].share === 0);
  h.check('§3 branch bars only across branches, and only with more than one', showBranchBars(dash()) && !showBranchBars(dash({ branch_id: 'k' })) && !showBranchBars(dash({}, [{ id: 'k', name: 'K', value: 1 }])) && !showBranchBars(null));
  // A DATE column reaches JSON as the server's midnight: Kuwait's (21:00Z the day before) or UTC's.
  const chart = dayChart([{ date: '2026-11-12T21:00:00.000Z', amount: 400 }, { date: '2026-11-13T00:00:00.000Z', amount: 1000 }, { date: '2026-11-13T21:00:00.000Z', amount: -50 }], TODAY);
  h.check('§3 chart days are Kuwait days, whichever midnight the server wrote', chart?.bars.map((b) => b.day).join() === '2026-11-13,2026-11-13,2026-11-14', chart?.bars.map((b) => b.day).join());
  h.check('§3 chart: a refund-heavy day is an empty bar, the newest is marked, today says Today', chart?.bars.map((b) => b.share).join() === '0.4,1,0' && chart?.bars[2].last === true && chart?.to === 'Today' && chart?.from === '13 Nov 2026');
  h.check('§3 chart caption: its best day (never set beside the Collected tile)', chart?.best?.day === '13 Nov 2026' && chart?.best?.amount === '1,000.000' && chart?.label === 'Collected each day, 13 Nov 2026 to 14 Nov 2026');
  h.check('§3 no rows, no chart; a quiet month has no best day', dayChart([], TODAY) === null && dayChart([{ date: '2026-11-14', amount: 0 }], TODAY)?.best === null);
  h.check('§3 the heading is the weekday and the house date', dayHeading(TODAY) === 'Saturday, 14 Nov 2026', dayHeading(TODAY));

  // §4 branches: the AMS's active list, and All first
  const bc = strip(readAmsFile('server/src/controllers/branchesController.js'));
  const gab = declOf(bc, 'getAllBranches');
  h.check('§4 /branches lists the active ones by default, as { branches: [{ id, name, … }] }', /const activeFilter = includeInactive \? '' : 'WHERE b\.is_active = TRUE';/.test(gab) && /SELECT b\.id, b\.name,/.test(gab) && /res\.json\(\{ count: result\.rows\.length, branches: result\.rows \}\)/.test(gab));
  const list = [{ id: 'k', name: 'Kuwait City' }, { id: 'm', name: 'Mahboula' }];
  h.check('§4 the picker: All branches first, then the AMS’s order', branchChips(list).map((c) => c.label).join() === 'All branches,Kuwait City,Mahboula' && branchChips(null).length === 1);
  h.check('§4 the label names the branch chosen', branchLabel(list, ALL) === 'All branches' && branchLabel(list, 'm') === 'Mahboula' && branchLabel(null, 'm') === 'One branch');

  // §5 Collections: GET /reports/financial
  const rc = strip(readAmsFile('server/src/controllers/reportsController.js'));
  const ddr = declOf(rc, 'defaultDateRange');
  const scope = declOf(rc, 'resolveReportScope');
  const fin = declOf(rc, 'getFinancialReport');
  h.check('§5 the extractors read (floor)', ddr.length > 200 && scope.length > 500 && fin.length > 4000, [ddr.length, scope.length, fin.length].join());
  h.check('§5 the dates are ?from_date= and ?to_date= (from and to are another report’s)', /fromDate: req\.query\.from_date \|\|/.test(ddr) && /toDate: req\.query\.to_date \|\|/.test(ddr) && /const \{ fromDate, toDate \} = defaultDateRange\(req\);/.test(fin));
  h.check('§5 a manager’s branch is ?branch_id=; none is every branch', /if \(role === 'manager'\) \{\s*return \{ branchId: req\.query\.branch_id \|\| null, error: null \};/.test(scope));
  h.check('§5 the path', financialPath({ from: '2026-11-01', to: '2026-11-14' }, ALL) === '/reports/financial?from_date=2026-11-01&to_date=2026-11-14' && financialPath({ from: '2026-10-01', to: '2026-10-31' }, 'm') === '/reports/financial?from_date=2026-10-01&to_date=2026-10-31&branch_id=m');
  h.check('§5 it sends summary, by_method and by_month with the app’s keys', ['total_collected', 'total_pending', 'total_overdue', 'total_refunds', 'refund_count', 'total_transactions'].every((k) => new RegExp(`${k}:\\s`).test(fin)) && /method_name: r\.method_name,/.test(fin) && /month_sort:\s+r\.month_sort,/.test(fin));
  h.check('§5 still-to-come and overdue are what is owed now, split at today', /CASE WHEN ii\.due_date >= NOW\(\)::date\s+THEN ii\.balance_due END/.test(fin) && /CASE WHEN ii\.due_date <\s+NOW\(\)::date\s+THEN ii\.balance_due END/.test(fin));
  h.check('§5 the months are the AMS’s “Mon YYYY” — the house style', /TO_CHAR\(t\.created_at, 'Mon YYYY'\)\s+AS month/.test(fin));
  const nov = monthRange(monthOf(TODAY), TODAY);
  h.check('§5 this month runs to today', nov.from === '2026-11-01' && nov.to === '2026-11-14' && nov.current && nov.title === 'November 2026' && nov.sub === '1 Nov 2026 – 14 Nov 2026', JSON.stringify(nov));
  const feb = monthRange({ y: 2024, m: 2 }, TODAY);
  h.check('§5 a past month runs to its last day (a leap February too)', feb.to === '2024-02-29' && !feb.current && monthRange({ y: 2026, m: 4 }, TODAY).to === '2026-04-30');
  h.check('§5 months step across a year, and forward stops at this month', JSON.stringify(shiftMonth({ y: 2026, m: 1 }, -1)) === '{"y":2025,"m":12}' && JSON.stringify(shiftMonth({ y: 2025, m: 12 }, 1)) === '{"y":2026,"m":1}' && canGoNext({ y: 2026, m: 10 }, TODAY) && !canGoNext({ y: 2026, m: 11 }, TODAY));
  const f: Financial = {
    period: { from: '2026-11-01', to: '2026-11-14' },
    summary: { total_collected: '18640.000', total_pending: '6480.000', total_overdue: '2640.500', total_refunds: '360.000', refund_count: 2, total_transactions: 412 },
    by_method: [{ method_name: 'KNET', txn_count: 214, total: '9820.000' }, { method_name: 'Cash', txn_count: 131, total: '5410.000' }],
    by_month: [{ month: 'Sep 2026', month_sort: '2026-09', total: '28940.000', count: 300 }, { month: 'Nov 2026', month_sort: '2026-11', total: '18640.000', count: 412 }, { month: 'Oct 2026', month_sort: '2026-10', total: '31205.000', count: 350 }],
  };
  h.check('§5 the hero line: payments, then refunds only when there were any', collectedLine(f.summary) === '412 payments · refunds KD 360.000' && collectedLine({ ...f.summary, refund_count: 0, total_transactions: 1 }) === '1 payment');
  h.check('§5 by method in the AMS’s order', methodRows(f).map((r) => `${r.label} ${r.amount} · ${r.count}`).join('|') === 'KNET 9,820.000 · 214|Cash 5,410.000 · 131');
  h.check('§5 month by month, newest first, this month “to date”', monthRows(f, TODAY).map((r) => r.label).join('|') === 'Nov 2026 (to date)|Oct 2026|Sep 2026' && monthRows(null, TODAY).length === 0);

  // §6 Fees overdue: GET /reports/overdue
  const od = declOf(rc, 'getOverdueDetail');
  h.check('§6 getOverdueDetail extracts (floor)', od.length > 3000, String(od.length));
  h.check('§6 overdue is days_late above 0 — the rest is pending, not late', /if \(item\.days_late > 0\) \{\s*overdue\.push\(item\);/.test(od) && /\(NOW\(\)::date - ii\.due_date\) AS days_late/.test(od));
  h.check('§6 it sends overdue, pending and the totals the app reads', /overdue,\s*\n\s*pending,/.test(od) && ['overdue_amount', 'overdue_count', 'pending_amount', 'pending_count'].every((k) => new RegExp(`${k}:\\s`).test(od)));
  h.check('§6 each row carries what the row shows and opens', ['student_id', 'student_name', 'balance_due', 'due_date', 'days_late', 'course_name', 'branch_name'].every((k) => new RegExp(`\\b${k}:\\s`).test(od)));
  h.check('§6 the branch is ?branch_id=; its date filters (from, to) are never sent', /const branchFilter = scope\.branchId;/.test(od) && /req\.query\.from \|\| null/.test(od) && overduePath(ALL) === '/reports/overdue' && overduePath('m') === '/reports/overdue?branch_id=m');
  const items = [item({ id: 'a', days_late: 5, balance_due: '35.000' }), item({ id: 'b', days_late: 61, balance_due: '120.000' }), item({ id: 'c', days_late: 25, balance_due: '190.000' }), item({ id: 'd', days_late: 61, balance_due: '200.000' })];
  h.check('§6 most late first (ties: the larger first)', sortOverdue(items, 'late').map((i) => i.id).join('') === 'dbca');
  h.check('§6 largest first (ties: the later first)', sortOverdue(items, 'large').map((i) => i.id).join('') === 'dcba');
  h.check('§6 sorting copies — the AMS’s order is kept', items.map((i) => i.id).join('') === 'abcd' && SORT_CHIPS.map((c) => c.value).join() === 'late,large');
  h.check('§6 over 30 days red, up to 30 amber', lateTone(31) === 'danger' && lateTone(30) === 'warning' && lateTone(1) === 'warning');
  h.check('§6 the row’s line: course, branch across branches, the due day in Kuwait', overdueLine(item(), true) === 'Computer Secretarial · Mahboula · due 14 Sep 2026' && overdueLine(item(), false) === 'Computer Secretarial · due 14 Sep 2026', overdueLine(item(), true));
  h.check('§6 the words', instalmentsWord(1) === 'instalment' && instalmentsWord(102) === 'instalments');

  // §7 wiring
  const tabs = read('../navigation/tabs.ts');
  const mgr = tabs.slice(tabs.indexOf('  manager: ['));
  h.check('§7 Dashboard and Reports are built in the manager’s tabs', /name: 'index',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr) && /name: 'reports',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr));
  h.check('§7 each route is its own screen', read('../app/manager/index.tsx').includes('return <DashboardScreen />;') && read('../app/manager/reports.tsx').includes('return <ReportsScreen />;'));
  h.check('§7 REPORTS_API is in today.check’s tables (every path it fills is checked)', /\n\s+REPORTS_API,\n/.test(read('../teacher/today.check.ts')));
  const hook = strip(read('../attendance/useAmsGet.ts'));
  h.check('§7 useAmsGet says which path its data answered', /dataPath: string \| null;/.test(hook) && /setData\(r\.value\);\s*setDataPath\(path\);/.test(hook));
  const ds = strip(read('./DashboardScreen.tsx'));
  const rs = strip(read('./ReportsScreen.tsx'));
  h.check('§7 the screens show figures only for the branch, period and month on screen', /dash\.dataPath === path/.test(ds) && /fin\.dataPath === finPath/.test(rs) && /over\.dataPath === overPath/.test(rs));
  h.check('§7 an overdue row opens the manager’s student profile', /pathname: STUDENT_PROFILE\.manager, params: \{ id: i\.student_id \}/.test(rs));
});
