import { existsSync, readFileSync } from 'node:fs';

import { declOf, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  APPROVALS_API,
  CERTIFICATES_PENDING,
  DECLINE_FIELD,
  DISCOUNTS_PENDING,
  REFUNDS_PENDING,
  alreadyDecided,
  declineBody,
  filterChips,
  notYetWords,
  readyToIssue,
} from './approvals.ts';

// Managers, bunch 1 (14 Nov 2026): Approvals (mockup 15) and Students, held to
// the AMS's routes (refunds.js, payments.js, certificates.js, dashboard.js), the
// controllers' own refusals, and the certificate workflow's stages.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
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
  h.check('§6 the chips count the cards the AMS sent', filterChips({ refund: 2, discount: 2, certificate: 3 }).map((c) => c.label).join('|') === 'All 7|Refunds 2|Discounts 2|Certificates 3');

  // §7 wiring
  const tabs = read('../navigation/tabs.ts');
  const mgr = tabs.slice(tabs.indexOf('  manager: ['));
  h.check('§7 Approvals and Students are built in the manager’s tabs', /name: 'approvals',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr) && /name: 'students',[^\n]*\n?[^\n]*phase: 4, built: true/.test(mgr));
  h.check('§7 the Approvals route is its own screen', read('../app/manager/approvals.tsx').includes('Tab: manager/approvals') && !read('../app/manager/approvals.tsx').includes('TabPlaceholder'));
  h.check('§7 Students is a stack with its index and profile, the front-desk screens', ['_layout', 'index', 'profile'].every((f) => existsSync(new URL(`../app/manager/students/${f}.tsx`, import.meta.url))) && !existsSync(new URL('../app/manager/students.tsx', import.meta.url)) && read('../app/manager/students/index.tsx').includes('<StudentsScreen who="manager" />'));
  h.check('§7 the front-desk mode is every staff view but the teacher’s', /const reception = who !== 'teacher';/.test(read('../teacher/StudentsScreen.tsx')) && /const reception = who !== 'teacher';/.test(read('../teacher/StudentScreen.tsx')));
  const screen = strip(read('./ApprovalsScreen.tsx'));
  h.check('§7 the screen reads (floor), and an approve is sent with no body', screen.length > 6000 && /let body: Record<string, string> \| undefined;/.test(screen) && /ams\.request\('POST', path, body\)/.test(screen));
});
