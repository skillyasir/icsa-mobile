import { existsSync, readFileSync } from 'node:fs';

import { declOf, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';
import { strip } from '../../scripts/strip.ts';

import {
  APPROVALS_API,
  CERTIFICATES_PENDING,
  DECLINE_FIELD,
  DISCOUNTS_PENDING,
  REFUNDS_PENDING,
  BOOKS_PENDING,
  CHECKINS_PENDING,
  KINDS,
  OUT_OF_STOCK_WORDS,
  OWN_CHECKIN_WORDS,
  TRANSFERS_PENDING,
  alreadyDecided,
  approveBody,
  bookFeeLine,
  bookInStock,
  bookRuleLine,
  checkinDoneWords,
  checkinLine,
  checkinPills,
  checkinTime,
  declineBody,
  filterChips,
  notYetWords,
  ownCheckin,
  readyToIssue,
  rejectWarning,
  settledWords,
  shownFilter,
  stockPill,
  transferDoneWords,
  transferWarning,
  type BookRequest,
  type Checkin,
  type Transfer,
} from './approvals.ts';

// Managers, bunch 1 (14 Nov 2026): Approvals (mockup 15) and Students, held to
// the AMS's routes (refunds.js, payments.js, certificates.js, dashboard.js), the
// controllers' own refusals, and the certificate workflow's stages.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

run('approvals.check — refunds, discounts and certificates as the AMS decides them (Managers bunch 1)', (h) => {
  // §1 the routes and who may call them
  const rf = strip(readAmsFile('server/src/routes/refunds.js'));
  const pay = strip(readAmsFile('server/src/routes/payments.js'));
  const cert = strip(readAmsFile('server/src/routes/certificates.js'));
  const dash = strip(readAmsFile('server/src/routes/dashboard.js'));
  h.check('§1 the approvals summary: manager and supervisor', /router\.get\('\/approvals', auth, authorize\('manager', 'supervisor'\), getApprovalsSummary\)/.test(dash));
  h.check('§1 refunds: listed by manager and supervisor; approved and rejected by a manager only', /router\.get\('\/',\s*auth, authorize\('manager', 'supervisor'\), getAllRefunds\)/.test(rf) && /router\.post\('\/:id\/approve', auth, authorize\('manager'\), approveRefund\)/.test(rf) && /router\.post\('\/:id\/reject',\s*auth, authorize\('manager'\), rejectRefund\)/.test(rf));
  h.check('§1 discount requests: listed by manager and supervisor; decided by a manager only', /router\.get\('\/discount-requests', auth, authorize\('manager', 'supervisor'\), getDiscountRequests\)/.test(pay) && /router\.post\('\/discount-requests\/:id\/approve', auth, authorize\('manager'\), approveDiscountRequest\)/.test(pay) && /router\.post\('\/discount-requests\/:id\/reject',\s*auth, authorize\('manager'\), rejectDiscountRequest\)/.test(pay));
  const managers = /const managers = authorize\(([^)]*)\)/.exec(cert)?.[1] ?? '';
  h.check('§1 certificate requests: approved and declined by managers', /'manager'/.test(managers) && /router\.post\('\/requests\/:id\/approve', auth, managers, c\.approveCertificateRequest\)/.test(cert) && /router\.post\('\/requests\/:id\/decline', auth, managers, c\.declineCertificateRequest\)/.test(cert), managers);
  h.check('§1 the app’s paths are those', APPROVALS_API.approveRefund.path === '/refunds/:id/approve' && APPROVALS_API.rejectDiscount.path === '/payments/discount-requests/:id/reject' && APPROVALS_API.declineCertificate.path === '/certificates/requests/:id/decline');

  // §2 the lists are the pending ones, as the AMS counts them
  const apc = strip(readAmsFile('server/src/controllers/approvalsController.js'));
  h.check('§2 refunds waiting are status initiated — the summary counts the same', REFUNDS_PENDING.endsWith('?status=initiated') && /FROM refunds WHERE status='initiated'/.test(apc));
  h.check('§2 discounts waiting are pending — the summary counts the same', DISCOUNTS_PENDING.endsWith('?status=pending') && /FROM discount_overrides WHERE status='pending'/.test(apc));
  h.check('§2 certificate requests waiting are pending', CERTIFICATES_PENDING.endsWith('?status=pending'));
  const refundsCtl = strip(readAmsFile('server/src/controllers/refundsController.js'));
  h.check('§2 the refund list filters on ?status', /const \{ status, student_id, enrollment_id \} = req\.query;/.test(refundsCtl));

  // §3 a decline carries its reason in the field each controller reads
  const payCtl = strip(readAmsFile('server/src/controllers/paymentsController.js'));
  const certCtl = strip(readAmsFile('server/src/controllers/certificatesController.js'));
  const rejectRefund = declOf(refundsCtl, 'rejectRefund');
  const rejectDiscount = declOf(payCtl, 'rejectDiscountRequest');
  const declineCert = declOf(certCtl, 'declineCertificateRequest');
  h.check('§3 the three decline functions extract (floor)', [rejectRefund, rejectDiscount, declineCert].every((x) => x.length > 400), [rejectRefund, rejectDiscount, declineCert].map((x) => x.length).join());
  h.check('§3 refund: rejection_reason, required', DECLINE_FIELD.refund === 'rejection_reason' && /const \{ rejection_reason \} = req\.body;/.test(rejectRefund) && /Rejection reason is required/.test(rejectRefund));
  h.check('§3 discount: note, required', DECLINE_FIELD.discount === 'note' && /req\.body\.note/.test(rejectDiscount) && /note is required/.test(rejectDiscount));
  h.check('§3 certificate: reason, required', DECLINE_FIELD.certificate === 'reason' && /req\.body\?\.reason/.test(declineCert) && /A declined request needs a reason/.test(declineCert));
  const b = declineBody('refund', '  Paid by mistake  ');
  h.check('§3 the reason goes trimmed, and an empty one is never sent', b.ok && JSON.stringify(b.body) === '{"rejection_reason":"Paid by mistake"}' && !declineBody('discount', '   ').ok);
  const approveCert = declOf(certCtl, 'approveCertificateRequest');
  h.check('§3 approving a certificate reads nothing from the body (overrides are stored on the request first)', approveCert.length > 3000 && !/req\.body/.test(approveCert));

  // §4 "already decided" is the AMS's own words — a second press is done, not an error
  const approveRefund = declOf(refundsCtl, 'approveRefund');
  h.check('§4 refund: the AMS’s words for one no longer initiated', /Cannot approve: refund is in status '/.test(approveRefund) && /Cannot reject: refund is in status '/.test(rejectRefund) && alreadyDecided('refund', "Cannot approve: refund is in status 'approved'") && alreadyDecided('refund', "Cannot reject: refund is in status 'rejected'"));
  const approveDiscount = declOf(payCtl, 'approveDiscountRequest');
  h.check('§4 discount: the AMS’s words for one no longer pending', /Request is not pending \(status: /.test(approveDiscount) && alreadyDecided('discount', 'Request is not pending (status: approved)'));
  h.check('§4 certificate: the AMS’s words for one already decided', approveCert.includes("'This request has already been approved.'") && approveCert.includes("'This request has already been declined.'") && alreadyDecided('certificate', 'This request has already been approved.'));
  h.check('§4 any other refusal is shown, never swallowed', !alreadyDecided('refund', 'Refund not found') && !alreadyDecided('discount', 'Schedule no longer exists') && !alreadyDecided('certificate', 'Certificates are on hold'));

  // §5 the certificate workflow: a manager issues only what was forwarded to him
  h.check('§5 ready to issue is the AMS’s stage with_manager', /cr\.stage !== 'with_manager'/.test(approveCert) && readyToIssue({ stage: 'with_manager' }) && !readyToIssue({ stage: 'returned' }) && !readyToIssue({ stage: 'with_academic' }));
  h.check('§5 why not yet, in the AMS’s words', approveCert.includes('It can be approved once it is resubmitted and forwarded.') && approveCert.includes('It can be approved once he forwards it.') && notYetWords({ stage: 'returned' }).endsWith('It can be approved once it is resubmitted and forwarded.') && notYetWords({ stage: 'x' }).endsWith('It can be approved once he forwards it.'));
  h.check('§5 the issuance hold answers 409 and is shown as it says', /issuance_held: true/.test(approveCert));

  // §6 the discount card reads the AMS's own columns
  h.check('§6 a discount request carries old_discount, new_discount and reason', /INSERT INTO discount_overrides \(schedule_id, old_discount, new_discount, delta, reason, status, created_by\)/.test(payCtl) && /u_req\.full_name AS requested_by_name/.test(payCtl));
  h.check('§6 the chips count the cards the AMS sent — All, then only the kinds with something waiting (Yasir, 15 Nov 2026)', filterChips({ refund: 2, discount: 0, certificate: 3, checkin: 1, transfer: 0, book: 1 }).map((c) => c.label).join('|') === 'All 7|Refunds 2|Certificates 3|Check-ins 1|Books 1' && filterChips({ refund: 0, discount: 0, certificate: 0, checkin: 0, transfer: 0, book: 0 }).map((c) => c.label).join('|') === 'All 0');
  const none = { refund: 0, discount: 0, certificate: 0, checkin: 0, transfer: 0, book: 0 };
  h.check('§6 a chosen kind whose last card went is All again (its chip is gone)', shownFilter('transfer', none) === 'all' && shownFilter('transfer', { ...none, transfer: 1 }) === 'transfer' && shownFilter('all', none) === 'all');
  h.check('§6 the six kinds, in the mockups’ order', KINDS.join() === 'refund,discount,certificate,checkin,transfer,book');
  h.check('§6 “already decided” is said as the AMS says it — which way it went, never this press’s own word', settledWords('refund', "Cannot approve: refund is in status 'rejected'") === 'This refund is already rejected.' && settledWords('discount', 'Request is not pending (status: approved)') === 'This discount is already approved.' && settledWords('transfer', 'This transfer is already cancelled.') === 'This transfer is already cancelled.' && settledWords('certificate', 'This request has already been declined.') === 'This request has already been declined.');

  // §7 wiring
  const tabs = read('../navigation/tabs.ts');
  const mgr = tabs.slice(tabs.indexOf('  manager: ['));
  h.check('§7 Approvals and Students are built in the manager’s tabs', /name: 'approvals',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr) && /name: 'students',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr));
  h.check('§7 the Approvals route is its own screen', read('../app/manager/approvals.tsx').includes('Tab: manager/approvals') && !read('../app/manager/approvals.tsx').includes('TabPlaceholder'));
  h.check('§7 Students is a stack with its index and profile, the front-desk screens', ['_layout', 'index', 'profile'].every((f) => existsSync(new URL(`../app/manager/students/${f}.tsx`, import.meta.url))) && !existsSync(new URL('../app/manager/students.tsx', import.meta.url)) && read('../app/manager/students/index.tsx').includes('<StudentsScreen who="manager" />'));
  h.check('§7 the front-desk mode is every staff view but the teacher’s', /const reception = who !== 'teacher';/.test(read('../teacher/StudentsScreen.tsx')) && /const reception = who !== 'teacher';/.test(read('../teacher/StudentScreen.tsx')));
  const screen = strip(read('./ApprovalsScreen.tsx'));
  h.check('§7 the screen reads (floor), and an approve sends approveBody — none, but a check-in’s decision', screen.length > 12000 && /let body: Record<string, string> \| undefined;/.test(screen) && /body = approveBody\(kind\);/.test(screen) && /ams\.request\('POST', path, body\)/.test(screen));
  h.check('§7 a request already decided is told in the AMS’s words, as information', /setOutcome\(\{ tone: 'info', text: settledWords\(kind, r\.failure\.message\) \}\)/.test(screen));
  h.check('§7 the chips and the cards follow the shown filter (a gone chip falls back to All)', /const showing = shownFilter\(filter, counts\);/.test(screen) && /<Chips options=\{filterChips\(counts\)\} value=\{showing\}/.test(screen));

  // §8 staff check-ins kept for review (Managers bunch 2, mockups approved 15 Nov 2026)
  const idx = strip(readAmsFile('server/src/index.js'));
  const sar = strip(readAmsFile('server/src/routes/staffAttendance.js'));
  const sac = strip(readAmsFile('server/src/controllers/staffAttendanceController.js'));
  h.check('§8 the routes: reviews listed and decided by a manager only', /app\.use\('\/api\/staff-attendance', require\('\.\/routes\/staffAttendance'\)\)/.test(idx) && /router\.get\('\/reviews', auth, authorize\('manager'\), c\.listReviews\)/.test(sar) && /router\.post\('\/taps\/:id\/decide', auth, authorize\('manager'\), c\.decide\)/.test(sar) && CHECKINS_PENDING === '/staff-attendance/reviews');
  const lr = declOf(sac, 'listReviews');
  const tapSql = /const TAP_SQL = `([\s\S]*?)`;/.exec(sac)?.[1] ?? '';
  h.check('§8 the list is the taps kept for review, with the name and the expected branch', /WHERE t\.review = 'pending'/.test(lr) && /u\.full_name, eb\.name AS expected_branch_name/.test(lr) && /res\.json\(\{ reviews: list \}\)/.test(lr));
  h.check('§8 each tap carries what the card shows', tapSql.length > 400 && ["t.work_date::text AS work_date", "to_char(t.tapped_at, 'HH24:MI') AS time", 't.place', 'b.name AS branch_name', 't.distance_m', 't.location_ok', 't.mocked', 't.wifi_ok', 't.review_reason', 't.kind', 't.user_id'].every((x) => tapSql.includes(x)), String(tapSql.length));
  const dec = declOf(sac, 'decide');
  h.check('§8 decide extracts (floor), locks the tap, and the first decision wins', dec.length > 1500 && /FOR UPDATE OF t/.test(dec) && /if \(t\.review !== 'pending'\) return await refuse\(409, 'This check-in has already been settled\.'\);/.test(dec) && alreadyDecided('checkin', 'This check-in has already been settled.'));
  h.check('§8 the body: decision accept or reject, and the note', /\['accept', 'reject'\]\.includes\(decision\)/.test(dec) && /req\.body\.note/.test(dec) && JSON.stringify(approveBody('checkin')) === '{"decision":"accept"}' && (() => { const b = declineBody('checkin', '  Not at the branch  '); return b.ok && JSON.stringify(b.body) === '{"decision":"reject","note":"Not at the branch"}'; })() && approveBody('refund') === undefined);
  h.check('§8 nobody decides their own — the card says the AMS’s words instead of offering it', dec.includes(`refuse(403, '${OWN_CHECKIN_WORDS}')`) && ownCheckin({ user_id: 'ABC-1' }, 'abc-1') && !ownCheckin({ user_id: 'abc-1' }, 'abc-2') && !ownCheckin({ user_id: 'abc-1' }, null));
  h.check('§8 rejecting a check-in makes the day absent — said only for a check-in', /review === 'rejected' && t\.kind === 'in' \? ' — the day counts as absent'/.test(dec) && rejectWarning({ kind: 'in' }) === 'Rejecting a check-in makes the day absent.' && rejectWarning({ kind: 'out' }) === null);
  const tap = (over: Partial<Checkin> = {}): Checkin => ({ id: 't', user_id: 'u', full_name: 'Layla Hassan', work_date: '2026-11-14', kind: 'in', time: '08:52', place: 'office', branch_name: 'Mahboula', expected_branch_name: 'Mahboula', location_ok: true, wifi_ok: false, distance_m: '40.4', mocked: false, review_reason: 'r', ...over });
  h.check('§8 the card: the time, the kind and the branch; online has no office', checkinTime(tap()) === '8:52 AM' && checkinLine(tap()) === 'Check in · Mahboula' && checkinLine(tap({ place: 'online', kind: 'out' })) === 'Check out · Online' && checkinLine(tap({ branch_name: null })) === 'Check in · Mahboula');
  h.check('§8 the checks as words — never the raw position; a fake-location app is said', checkinPills(tap()).map((p) => p.text).join('|') === 'Location ✓ 40 m|Wi-Fi ✗' && checkinPills(tap({ mocked: true, location_ok: false, wifi_ok: null, distance_m: null })).map((p) => p.text).join('|') === 'Location ✗|Fake-location app' && checkinPills(tap({ place: 'online' })).length === 0);
  h.check('§8 the done words are the AMS’s audit words', checkinDoneWords(tap(), true) === 'Accepted — Layla Hassan’s check in.' && checkinDoneWords(tap({ full_name: null, kind: 'lunch_out' }), false) === 'Rejected — the lunch out.' && /\(review === 'accepted' \? 'Accepted ' : 'Rejected '\) \+ t\.full_name \+ '’s '/.test(dec));

  // §9 payment transfers — approving moves the money, once
  const ptr = strip(readAmsFile('server/src/routes/paymentTransfers.js'));
  const ptc = strip(readAmsFile('server/src/controllers/paymentTransfersController.js'));
  const pts = strip(readAmsFile('server/src/services/paymentTransfers.js'));
  h.check('§9 the routes: listed by manager and supervisor; approved and rejected by a manager only', /app\.use\('\/api\/payment-transfers', require\('\.\/routes\/paymentTransfers'\)\)/.test(idx) && /const staff = authorize\('manager', 'supervisor'\);/.test(ptr) && /router\.get\('\/', auth, staff, c\.listTransfers\)/.test(ptr) && /router\.post\('\/:id\/approve', auth, authorize\('manager'\), c\.approveTransfer\)/.test(ptr) && /router\.post\('\/:id\/reject', auth, authorize\('manager'\), c\.rejectTransfer\)/.test(ptr));
  const lt = declOf(ptc, 'listTransfers');
  h.check('§9 the waiting ones are status requested', /\['requested', 'approved', 'rejected', 'cancelled'\]\.includes\(status\)/.test(lt) && TRANSFERS_PENDING === '/payment-transfers?status=requested' && /res\.json\(\{ transfers: r\.rows/.test(lt));
  const sel = /const TRANSFER_SELECT_SQL = `([\s\S]*?)`;/.exec(pts)?.[1] ?? '';
  h.check('§9 each transfer carries what the card shows', sel.length > 500 && ['pt.amount', 'pt.reason', 'pt.withdraw_source', 'pt.requested_at', 'fe.enrollment_no AS from_enrollment_no', 'fc.name AS from_course_name', 'fu.full_name AS from_student_name', 'fb.name AS from_branch_name', 'te.enrollment_no AS to_enrollment_no', 'tc.name AS to_course_name', 'tu.full_name AS to_student_name', 'tb.name AS to_branch_name', 'ru.full_name AS requested_by_name'].every((x) => sel.includes(x)), String(sel.length));
  const at = declOf(ptc, 'approveTransfer');
  h.check('§9 approve extracts (floor) and moves the money: two transactions, out and in', at.length > 3000 && (at.match(/INSERT INTO actual_transactions/g) ?? []).length === 2);
  h.check('§9 once only: the row is locked and a second decision is refused — and said as settled', /SELECT \* FROM payment_transfers WHERE id = \$1 FOR UPDATE/.test(at) && /if \(t\.status !== 'requested'\) return stop\(409, 'This transfer is already ' \+ t\.status \+ '\.'\);/.test(at) && alreadyDecided('transfer', 'This transfer is already approved.') && !alreadyDecided('transfer', 'Not approved — the amount is more than was paid'));
  h.check('§9 the answer says whether the source was withdrawn; the card says it before the press', /res\.json\(\{ transfer: after, from: publicMoney\(srcAfter\), to: publicMoney\(dstAfter\), withdrawal \}\)/.test(at) && /if \(t\.withdraw_source\) \{/.test(at) && transferWarning({ withdraw_source: true, from_enrollment_no: 'EN-1042' }) === 'Approving also withdraws EN-1042.' && transferWarning({ withdraw_source: false, from_enrollment_no: 'EN-1042' }) === null);
  const xf = { amount: '120', from_enrollment_no: 'EN-1042', to_enrollment_no: 'EN-1103' } as Transfer;
  h.check('§9 the done words', transferDoneWords(xf, true) === 'Approved — KD 120.000 moved from EN-1042 to EN-1103, and EN-1042 withdrawn.' && transferDoneWords(xf, false) === 'Approved — KD 120.000 moved from EN-1042 to EN-1103.');
  const dd = declOf(ptc, 'decide');
  h.check('§9 a rejection needs its reason, read from reason', /req\.body\.reason \|\| req\.body\.note/.test(dd) && /if \(to === 'rejected' && !why\) return res\.status\(400\)/.test(dd) && (() => { const b = declineBody('transfer', ' Wrong course '); return b.ok && JSON.stringify(b.body) === '{"reason":"Wrong course"}'; })());

  // §10 free books — approving takes a copy out of the branch's stock
  const enr = strip(readAmsFile('server/src/routes/enrollments.js'));
  const ebc = strip(readAmsFile('server/src/controllers/enrollmentBooksController.js'));
  h.check('§10 the routes: listed, approved and rejected by a manager only', /app\.use\('\/api\/enrollments', require\('\.\/routes\/enrollments'\)\)/.test(idx) && /router\.get\('\/books\/approvals', auth, authorize\('manager'\), listBookApprovals\)/.test(enr) && /router\.post\('\/:id\/books\/:releaseId\/approve', auth, authorize\('manager'\), approveFree\)/.test(enr) && /router\.post\('\/:id\/books\/:releaseId\/reject', auth, authorize\('manager'\), rejectFree\)/.test(enr));
  const lba = declOf(ebc, 'listBookApprovals');
  h.check('§10 the waiting ones are approval_pending — the summary counts the same', /if \(status === 'pending'\) where = "r\.status = 'approval_pending'"/.test(lba) && BOOKS_PENDING === '/enrollments/books/approvals?status=pending' && /FROM enrollment_book_releases WHERE status='approval_pending'/.test(apc));
  h.check('§10 each request carries what the card shows: the book, its value, the stock, the fee and the free rule', ['r.book_title', 'i.sale_price', 'r.approval_requested_at', 'AS stock_on_hand', 'u.full_name AS student_name', 'c.name AS course_name', 'b.name AS branch_name', 'requ.full_name AS requested_by_name', 'r.enrollment_id'].every((x) => lba.includes(x)) && /fee: \{\s*net_amount: r3\(fee\.net_amount\),\s*total_paid: r3\(fee\.total_paid\),\s*balance: r3\(fee\.balance\),\s*has_fee_schedule: fee\.has_fee_schedule,/.test(lba) && /free_rule: \{\s*threshold:[^,]*,\s*window_days: windowDays,\s*window_ends: windowEnds,\s*paid_in_window: r3\(inWindow\),/.test(lba) && /res\.json\(\{ count: approvals\.length, approvals \}\)/.test(lba));
  const af = declOf(ebc, 'approveFree');
  h.check('§10 approve extracts (floor), locks the request, and a second decision is settled', af.length > 1200 && /FOR UPDATE OF r/.test(af) && /return res\.status\(409\)\.json\(\{ error: 'Not awaiting approval' \}\)/.test(af) && alreadyDecided('book', 'Not awaiting approval') && settledWords('book', 'Not awaiting approval') === 'This free book is already decided.');
  h.check('§10 no copy at the branch, no release — the card holds Approve back, in the AMS’s words', /if \(onHand <= 0\) \{/.test(af) && af.includes(`json({ error: '${OUT_OF_STOCK_WORDS}' })`) && !bookInStock({ stock_on_hand: 0 }) && !bookInStock({ stock_on_hand: '-1' }) && bookInStock({ stock_on_hand: 3 }) && /approveOff/.test(screen) && /'Reject', !stocked\)/.test(screen));
  const rf2 = declOf(ebc, 'rejectFree');
  h.check('§10 a rejection carries its reason in reason', /const \{ reason \} = req\.body;/.test(rf2) && (() => { const b = declineBody('book', 'Fee not paid'); return b.ok && JSON.stringify(b.body) === '{"reason":"Fee not paid"}'; })());
  const bk = (over: Partial<BookRequest> = {}): BookRequest => ({ id: 'r', enrollment_id: 'e', book_title: 'IELTS Practice Book 1', sale_price: '8', approval_requested_at: null, student_name: 'Priya Nair', course_name: 'IELTS', branch_name: 'Kuwait City', requested_by_name: null, stock_on_hand: 3, fee: { net_amount: 180, total_paid: 90, balance: 90, has_fee_schedule: true }, free_rule: { threshold: 100, window_days: 10, window_ends: '2026-11-18', paid_in_window: 90 }, ...over });
  h.check('§10 the lines: the fee (no plan is not paid in full), the free rule, the stock', bookFeeLine(bk()) === 'KD 90.000 paid of KD 180.000 · balance KD 90.000' && bookFeeLine(bk({ fee: { net_amount: 0, total_paid: 0, balance: 0, has_fee_schedule: false } })) === 'No fee plan on record' && bookRuleLine(bk()) === 'KD 100.000 paid within 10 days (by 18 Nov 2026) — paid KD 90.000 so far' && stockPill(bk()).text === '3 in stock at Kuwait City' && stockPill(bk({ stock_on_hand: 0, branch_name: 'Mahboula' })).text === 'None in stock at Mahboula');

  // §11 every decline in the app asks its reason (the mockups, 15 Nov 2026)
  h.check('§11 a decline without a reason is never sent, whatever the kind', KINDS.every((k) => !declineBody(k, '   ').ok));
  h.check('§11 the book path names the enrolment and the request', /pathFor\(APPROVALS_API\.approveBook\.path, \{ id: enr, releaseId: id \}\)/.test(screen) && /pathFor\(APPROVALS_API\.rejectBook\.path, \{ id: enr, releaseId: id \}\)/.test(screen));
  h.check('§11 your own check-in shows the AMS’s words and no buttons', /\{mine \? \(\s*<AppText[^>]*>\{OWN_CHECKIN_WORDS\}<\/AppText>\s*\) : \(/.test(screen));
});
