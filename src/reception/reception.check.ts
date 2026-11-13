import { readFileSync } from 'node:fs';

import { amsFirewallAdmits, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  ALREADY_REVIEWED,
  ATTENDANCE_OUTCOMES,
  DASHBOARD_TODAY,
  FOLLOWUP_TABS,
  LOG_TYPES,
  PAYMENT_OUTCOMES,
  RECEPTION_API,
  addDaysYmd,
  caseBadge,
  daysBetween,
  kdAmount,
  logBody,
  minePath,
  needsYou,
  todayFigures,
  type Dashboard,
  type FollowupCounts,
  type OutcomeChoice,
} from './rules.ts';

// Reception in the app (13 Nov 2026): Today, Follow-ups and the payment
// proofs, held to the AMS's own routes (dashboard.js, followups.js,
// paymentProofs.js), controllers (dashboard, approvals, followups,
// paymentProofs), the follow-up service's outcome list and the website's
// pickers (client/src/components/followups/fuUi.js). Reception is the
// supervisor (lib/roles.ts).

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));
/** A function's body by name: past its parameters (parentheses matched, so a destructured one is skipped), then its braces. */
function bodyOf(src: string, name: string): string {
  const at = src.search(new RegExp(`(const|function)\\s+${name}\\b`));
  if (at < 0) return '';
  let i = src.indexOf('(', at);
  if (i < 0) return '';
  for (let depth = 0; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) break;
  }
  const open = src.indexOf('{', i);
  if (open < 0 || !/^\)\s*(=>)?\s*$/.test(src.slice(i, open))) return '';
  for (let depth = 0, j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(open, j + 1);
  }
  return '';
}
/** The website's outcome pickers: { key, label, promise } in order, read from fuUi.js. */
function fuList(src: string, name: string): OutcomeChoice[] {
  const block = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\];`).exec(src)?.[1] ?? '';
  return [...block.matchAll(/\{\s*key:\s*"([a-z_]+)",\s*label:\s*"([^"]+)"(,\s*promise:\s*true)?/g)].map((m) => (m[3] ? { key: m[1], label: m[2], promise: true } : { key: m[1], label: m[2] }));
}
const words = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
const esc = (s: string) => s.replace(/[/:.]/g, (c) => '\\' + c);

run('reception.check — Today, Follow-ups and payment proofs agree with the AMS', (h) => {
  // §0 the helpers
  h.check('§0 bodyOf extracts an arrow and a declaration, nested braces whole',
    bodyOf('const f = async (req, res) => { if (a) { b(); } };', 'f') === '{ if (a) { b(); } }' &&
    bodyOf('function g({ x }) { return { y: x }; }', 'g') === '{ return { y: x }; }' &&
    bodyOf('nothing', 'f') === '');
  h.check('§0 fuList reads key, label and the promise flag, in order',
    JSON.stringify(fuList('export const X = [\n  { key: "a_b", label: "A – b", promise: true, hint: "h" },\n  { key: "c", label: "C", hint: "h" },\n];', 'X')) ===
      JSON.stringify([{ key: 'a_b', label: 'A – b', promise: true }, { key: 'c', label: 'C' }]));

  // §1 every endpoint is routed where the app calls it, to a role reception holds
  const index = strip(readAmsFile('server/src/index.js'));
  const R = {
    dashboard: { mount: '/dashboard', src: strip(readAmsFile('server/src/routes/dashboard.js')) },
    followups: { mount: '/followups', src: strip(readAmsFile('server/src/routes/followups.js')) },
    'payment-proofs': { mount: '/payment-proofs', src: strip(readAmsFile('server/src/routes/paymentProofs.js')) },
  };
  h.check('§1 the AMS routes were read (floor)', index.length > 5000 && Object.values(R).every((r) => r.src.length > 300));
  for (const r of Object.values(R)) h.check(`§1 the router is mounted at /api${r.mount}`, new RegExp(`app\\.use\\(\\s*'\\/api${esc(r.mount)}'`).test(index));
  const eps = Object.entries(RECEPTION_API);
  h.check('§1 nine endpoints (cardinality)', eps.length === 9);
  for (const [key, e] of eps) {
    const r = Object.values(R).find((x) => e.path === x.mount || e.path.startsWith(x.mount + '/'));
    const sub = r ? e.path.slice(r.mount.length) || '/' : '';
    const m = r ? new RegExp(`router\\.${e.method.toLowerCase()}\\('${esc(sub)}',\\s*auth,([^\\n]*)`).exec(r.src) : null;
    const rest = m?.[1] ?? '';
    const who = /authorize\(([^)]*)\)/.exec(rest)?.[1];
    // No authorize() at all: the controller decides who sees what (the Follow-up Centre's own scope).
    h.check(`§1 RECEPTION_API.${key}: ${e.method} ${e.path} is routed, and a supervisor may use it`, !!m && (who === undefined || words(who).includes('supervisor')), rest.trim());
  }
  const admits = amsFirewallAdmits();
  const staffOnly = eps.filter(([k]) => k !== 'proofMethods');
  h.check('§1 no reception path but the methods list is open to a student token',
    staffOnly.every(([, e]) => !admits(e.method, '/api' + e.path.replace(':id', '00000000-0000-0000-0000-000000000000'))));
  h.check('§1 …and the methods list is (a student picks one when uploading a proof)', admits('GET', '/api' + RECEPTION_API.proofMethods.path));

  // §2 Today: the dashboard's and the approvals summary's own field names
  const dash = strip(readAmsFile('server/src/controllers/dashboardController.js'));
  const getDash = bodyOf(dash, 'getDashboard');
  h.check('§2 getDashboard extracts (floor)', getDash.length > 10000, String(getDash.length));
  h.check('§2 the dashboard takes ?period=today', /const validPeriods = \[[^\]]*'today'/.test(getDash) && DASHBOARD_TODAY.endsWith('?period=today'));
  const kpis = /kpis:\s*\{([\s\S]*?)\n\s*\},/.exec(getDash)?.[1] ?? '';
  h.check('§2 kpis carries collection_today, enrollments_today and live_attendance', ['collection_today', 'enrollments_today', 'live_attendance'].every((k) => new RegExp(`\\b${k}:`).test(kpis)), kpis.slice(0, 120));
  const breakdown = bodyOf(dash, 'buildBranchBreakdown');
  h.check('§2 …each a breakdown with a total (enrolments and check-ins)', /return \{\s*total/.test(breakdown) && /const enrollmentsToday = buildBranchBreakdown\(/.test(getDash) && /const liveAttendance = buildBranchBreakdown\(/.test(getDash));
  const coll = bodyOf(dash, 'buildCollection');
  h.check('§2 …and the collection a total too', coll.length > 200 && /\btotal\b/.test(coll) && /const collectionToday = await buildCollection\(/.test(getDash));
  h.check('§2 scope names the branch', /scope:\s*\{[\s\S]*?branch_name:/.test(getDash));
  const appr = strip(readAmsFile('server/src/controllers/approvalsController.js'));
  const apprJson = /res\.json\(\{([\s\S]*?)\}\)/.exec(bodyOf(appr, 'getApprovalsSummary'))?.[1] ?? '';
  h.check('§2 the approvals summary answers payment_proofs, refunds, discounts, books', ['payment_proofs', 'refunds', 'discounts', 'books'].every((k) => new RegExp(`\\b${k}:`).test(apprJson)), apprJson.trim());
  const D: Dashboard = { scope: { role: 'supervisor', branch_id: 'b', branch_name: 'City Branch' }, kpis: { collection_today: { total: 1240.5 }, enrollments_today: { total: 3 }, live_attendance: { total: 41 } } };
  h.check('§2 the tiles show the AMS figures as sent (KD with three decimals, thousands separated)',
    JSON.stringify(todayFigures(D).map((f) => f.value)) === '["1,240.500","3","41"]' && kdAmount(0) === '0.000' && kdAmount('12345678.9') === '12,345,678.900' && kdAmount(null) === '—' && kdAmount('') === '—');
  const F0: FollowupCounts = { overdue: 0, today: 0, upcoming: 4, waiting: 2, attendance: 6, payment: 0, kd_overdue: 0 };
  h.check('§2 Needs you leaves a zero row out', needsYou({ payment_proofs: 0, refunds: 1, discounts: 0, books: 0 }, F0).length === 0);
  const rows = needsYou({ payment_proofs: 2, refunds: 0, discounts: 0, books: 0 }, { ...F0, overdue: 1, today: 2, payment: 1 });
  h.check('§2 …and shows proofs, follow-ups due (overdue + today) and fees overdue',
    rows.map((r) => `${r.key}:${r.count}`).join() === 'proofs:2,followups:3,fees:1');

  // §3 Follow-ups: the Follow-up Centre's list, its outcomes and its log
  const fu = strip(readAmsFile('server/src/controllers/followupsController.js'));
  const mine = bodyOf(fu, 'getMine');
  const log = bodyOf(fu, 'logCase');
  h.check('§3 getMine and logCase extract (floor)', mine.length > 2500 && log.length > 1000, `${mine.length}/${log.length}`);
  const path = new URL('http://x' + minePath('payment'));
  h.check('§3 the list asks for the action view (overdue, today, upcoming)', path.searchParams.get('view') === 'action' && /\['waiting', 'closed'\]\.includes\(q\.view\) \? q\.view : 'action'/.test(mine) && /IN \('overdue','today','upcoming'\)/.test(mine));
  const sorts = /const MINE_SORTS = \{([\s\S]*?)\n\};/.exec(fu)?.[1] ?? '';
  h.check('§3 …most urgent first (a sort the AMS knows)', path.searchParams.get('sort') === 'urgent' && /^\s*urgent:/m.test(sorts));
  const size = Number(new URL('http://x' + minePath()).searchParams.get('size'));
  h.check('§3 …one page within the AMS cap (5 to 100)', size >= 5 && size <= 100 && /Math\.min\(100, Math\.max\(5, parseInt\(q\.size, 10\)/.test(mine), String(size));
  h.check('§3 …filtered by a kind the AMS reads', path.searchParams.get('kind') === 'payment' && /\['attendance', 'payment'\]\.includes\(q\.kind\)/.test(mine) && !new URL('http://x' + minePath()).searchParams.has('kind'));
  const counts = /const counts = \{([\s\S]*?)\};/.exec(mine)?.[1] ?? '';
  const countKeys: (keyof FollowupCounts)[] = ['overdue', 'today', 'upcoming', 'waiting', 'attendance', 'payment', 'kd_overdue'];
  h.check('§3 every count the app reads is one the AMS sends', countKeys.every((k) => new RegExp(`\\b${k}:`).test(counts)), counts.replace(/\s+/g, ' '));
  h.check('§3 the tabs are AMS buckets', FOLLOWUP_TABS.every((t) => counts.includes(`${t.key}:`)) && FOLLOWUP_TABS.length === 3);
  h.check('§3 the list answers counts, cases, total, page, size', /res\.json\(\{ counts, cases,[^}]*total:[^}]*page, size \}\)/.test(mine));
  const cols = /const CASE_COLS = `([\s\S]*?)`;/.exec(fu)?.[1] ?? '';
  const facts = /const STUDENT_FACTS_SQL = `([\s\S]*?)`;/.exec(fu)?.[1] ?? '';
  const caseFields = ['id', 'student_id', 'kind', 'trigger_status', 'student_name', 'student_phone', 'student_code', 'course_name', 'enrollment_no', 'attempts', 'last_outcome', 'last_note', 'last_log_at', 'amount_due', 'due_since', 'due_at', 'promise_date', 'escalation_level'];
  const named = (f: string) => new RegExp(`(\\bfc\\.${f}\\b(?!\\s*\\w)|\\bAS ${f}\\b|\\bs\\.${f}\\b|\\ben\\.${f}\\b)`).test(cols);
  h.check('§3 every case field the screen reads is a column the AMS selects', cols.length > 500 && caseFields.every(named), caseFields.filter((f) => !named(f)).join());
  h.check('§3 …the case id is the case’s own (fc.id first, so POST /cases/:id/log takes it)', /^\s*fc\.id,/.test(cols));
  h.check('§3 …and last_present comes from the student facts', /AS last_present/.test(facts) && /\$\{STUDENT_FACTS_SQL\}/.test(cols));

  const fuUi = readAmsFile('client/src/components/followups/fuUi.js');
  const webAtt = fuList(fuUi, 'ATTENDANCE_OUTCOMES');
  const webPay = fuList(fuUi, 'PAYMENT_OUTCOMES');
  h.check('§3 the website’s pickers were read (floor)', webAtt.length >= 6 && webPay.length >= 6, `${webAtt.length}/${webPay.length}`);
  h.check('§3 attendance outcomes: the website’s, word for word, in order, with its promise flags', JSON.stringify(webAtt) === JSON.stringify(ATTENDANCE_OUTCOMES));
  h.check('§3 payment outcomes: the website’s, word for word, in order, with its promise flags', JSON.stringify(webPay) === JSON.stringify(PAYMENT_OUTCOMES));
  const svc = strip(readAmsFile('server/src/services/followupCases.js'));
  const outcomes = /const OUTCOMES = \{([\s\S]*?)\n\};/.exec(svc)?.[1] ?? '';
  const amsOutcome = new Map([...outcomes.matchAll(/^\s*(\w+):\s*\{([^}]*)\}/gm)].map((m) => [m[1], m[2]]));
  h.check('§3 the AMS outcome list was read (floor)', amsOutcome.size >= 12, String(amsOutcome.size));
  const all = [...ATTENDANCE_OUTCOMES, ...PAYMENT_OUTCOMES];
  h.check('§3 every outcome the app sends is one logCase accepts (else it is dropped as null)', all.every((o) => amsOutcome.has(o.key)) && /F\.USER_OUTCOMES\.includes\(b\.outcome\)/.test(log), all.filter((o) => !amsOutcome.has(o.key)).map((o) => o.key).join());
  h.check('§3 an outcome asks for a date exactly when the AMS treats it as a promise', all.every((o) => !!o.promise === /promise:/.test(amsOutcome.get(o.key) ?? '')));
  const types = words(/const TYPES = \[([^\]]*)\]/.exec(svc)?.[1] ?? '');
  h.check('§3 a call and a WhatsApp are log types the AMS keeps (anything else becomes a call)', LOG_TYPES.every((t) => types.includes(t)), types.join());

  const amsReads = new Set([...log.matchAll(/\bb\.(\w+)/g)].map((m) => m[1]));
  h.check('§3 logCase reads exactly these fields', ['type', 'outcome', 'note', 'next_date', 'promise_date', 'promise_amount'].every((k) => amsReads.has(k)) && amsReads.size === 6, [...amsReads].sort().join());
  const today = '2026-11-13';
  const promise = PAYMENT_OUTCOMES.find((o) => o.promise)!;
  const full = logBody({ type: 'whatsapp', outcome: promise, note: '  Will pay Saturday ', nextDate: '2026-11-16', promiseDate: '2026-11-15', promiseAmount: '45', today });
  h.check('§3 a log sends only fields logCase reads', full.ok && Object.keys(full.body).every((k) => amsReads.has(k)), full.ok ? Object.keys(full.body).join() : full.message);
  h.check('§3 …dates as YYYY-MM-DD, the amount a number, the note trimmed', full.ok && full.body.promise_date === '2026-11-15' && full.body.next_date === '2026-11-16' && full.body.promise_amount === 45 && full.body.note === 'Will pay Saturday' && full.body.type === 'whatsapp');
  const msg = (r: ReturnType<typeof logBody>) => (r.ok ? '' : r.message);
  const amsSays = (s: string) => log.includes(`'${s.replace(/\.$/, '')}'`);
  const empty = logBody({ type: 'call', outcome: null, note: '  ', nextDate: null, promiseDate: null, promiseAmount: '', today });
  h.check('§3 no outcome and no note is refused first, in the AMS’s words', !empty.ok && amsSays(msg(empty)), msg(empty));
  const past = logBody({ type: 'call', outcome: null, note: 'x', nextDate: '2026-11-12', promiseDate: null, promiseAmount: '', today });
  h.check('§3 a next date in the past is refused first, in the AMS’s words', !past.ok && amsSays(msg(past)), msg(past));
  const pastPromise = logBody({ type: 'call', outcome: promise, note: '', nextDate: null, promiseDate: '2026-11-01', promiseAmount: '', today });
  h.check('§3 a promise in the past is refused first, in the AMS’s words', !pastPromise.ok && amsSays(msg(pastPromise)), msg(pastPromise));
  const noDate = logBody({ type: 'call', outcome: promise, note: '', nextDate: null, promiseDate: null, promiseAmount: '', today });
  h.check('§3 a promise outcome without its date is refused (the website asks for it too)', !noDate.ok);
  const plain = logBody({ type: 'call', outcome: ATTENDANCE_OUTCOMES.find((o) => o.key === 'no_answer')!, note: '', nextDate: null, promiseDate: '2026-11-20', promiseAmount: '5', today });
  h.check('§3 a promise date or amount is never sent with an outcome that is not a promise', plain.ok && !('promise_date' in plain.body) && !('promise_amount' in plain.body) && !('next_date' in plain.body));
  h.check('§3 a date today is not "in the past" (the AMS compares with CURRENT_DATE)', logBody({ type: 'call', outcome: null, note: 'x', nextDate: today, promiseDate: null, promiseAmount: '', today }).ok && /nextDate < today/.test(log));
  h.check('§3 dates add across a month end', addDaysYmd('2026-11-29', 3) === '2026-12-02' && daysBetween('2026-11-01', today) === 12 && daysBetween(null, today) === null);
  const ranks = /const RANK = \{([^}]*)\}/.exec(svc)?.[1] ?? '';
  h.check('§3 the pill names the statuses that open a case (Critical red, At Risk amber)', /Critical/.test(ranks) && /'At Risk'/.test(ranks) && caseBadge({ kind: 'attendance', trigger_status: 'Critical' }).tone === 'danger' && caseBadge({ kind: 'attendance', trigger_status: 'At Risk' }).tone === 'warning' && caseBadge({ kind: 'payment', trigger_status: null }).text === 'Fee overdue');

  // §4 payment proofs: approve names the method, reject a reason; a second review is a 409
  const pp = strip(readAmsFile('server/src/controllers/paymentProofsController.js'));
  const approve = bodyOf(pp, 'approveProof');
  const reject = bodyOf(pp, 'rejectProof');
  const listFn = bodyOf(pp, 'listProofs');
  h.check('§4 the proof handlers extract (floor)', approve.length > 2000 && reject.length > 600 && listFn.length > 400, `${approve.length}/${reject.length}/${listFn.length}`);
  h.check('§4 approve reads payment_method_id and refuses without it', /req\.body\.payment_method_id/.test(approve) && /if \(!paymentMethodId\)/.test(approve));
  h.check('§4 reject reads reason', /const \{ reason \} = req\.body/.test(reject));
  const screen = read('./ProofsScreen.tsx');
  h.check('§4 the screen approves with { payment_method_id } and rejects with { reason }',
    /pathFor\(RECEPTION_API\.approveProof\.path, \{ id: p\.id \}\), \{ payment_method_id: m\.id \}\)/.test(screen) && /pathFor\(RECEPTION_API\.rejectProof\.path, \{ id: p\.id \}\), \{ reason:/.test(screen));
  h.check('§4 "already reviewed" is the AMS’s 409, word for word, on both', approve.includes(`status(409).json({ error: '${ALREADY_REVIEWED}' })`) && reject.includes(`status(409).json({ error: '${ALREADY_REVIEWED}' })`));
  h.check('§4 …and the screen reads it as done, never as a failure', /ALREADY_REVIEWED/.test(screen));
  h.check('§4 approve locks the proof first, so a second press never records a second payment', /FOR UPDATE/.test(approve) && approve.indexOf('FOR UPDATE') < approve.indexOf('INSERT INTO actual_transactions'));
  h.check('§4 the list answers { count, proofs } with the student, course and file', /res\.json\(\{ count: r\.rows\.length, proofs: r\.rows \}\)/.test(listFn) && /AS student_name/.test(listFn) && /s\.student_code/.test(listFn) && /AS course_name/.test(listFn) && /p\.\*/.test(listFn));
  h.check('§4 the methods answer { methods }', /res\.json\(\{ methods: r\.rows \}\)/.test(bodyOf(pp, 'getMethods')));

  // §5 the screens use these rules (no second copy)
  const todayS = read('./TodayScreen.tsx');
  const fuS = read('./FollowupsScreen.tsx');
  h.check('§5 Today reads today’s dashboard, the approvals and the follow-ups, and draws them through todayFigures / needsYou',
    /DASHBOARD_TODAY/.test(todayS) && /RECEPTION_API\.approvals\.path/.test(todayS) && /minePath\(/.test(todayS) && /todayFigures\(/.test(todayS) && /needsYou\(/.test(todayS));
  h.check('§5 Follow-ups logs through logBody and the AMS path, and offers outcomesFor(kind)',
    /logBody\(/.test(fuS) && /pathFor\(RECEPTION_API\.logFollowup\.path, \{ id: c\.id \}\), b\.body\)/.test(fuS) && /outcomesFor\(c\.kind\)/.test(fuS));
  h.check('§5 no screen keeps its own outcome list', ![todayS, fuS].some((s) => /will_return|promised_payment/.test(s)));
});
