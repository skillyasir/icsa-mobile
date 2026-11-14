import { existsSync, readFileSync } from 'node:fs';

import { declOf, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import { waNumber } from '../teacher/students.ts';
import {
  BUCKETS,
  COUPON_TERMS,
  MORE_API,
  PUBLIC_SITE,
  bucketPath,
  couponBody,
  daysLeftInMonth,
  kdShort,
  linkLine,
  linkUrl,
  pdfBody,
  pdfName,
  shareText,
  targetOf,
  thisMonth,
  waShareUrl,
  waUrl,
  type LeadLink,
  type Referral,
} from './more.ts';

// Marketers, bunch 2 (14 Nov 2026): Follow-ups, New and Referrals, held to the
// AMS's routes and controllers, and to the website's own code — its coupon
// message (couponUi.shareText) and WhatsApp links (lib/waLink.js) RUN beside
// the app's copies; its referral order (lib/referrals.js) vendored verbatim.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

run('more.check — Follow-ups, New and Referrals as the AMS and the website keep them (Marketers bunch 2)', (h) => {
  // §0 the shared extractor (scripts/ams.ts; self-tested in money.check §0) still finds an arrow const
  h.check('§0 declOf reads an arrow const to its semicolon', declOf('export const f = (a) => {\n  return "}";\n};', 'f') === 'const f = (a) => {\n  return "}";\n};');

  // §1 the routes, open to a marketer, mounted where the app calls them
  const idx = strip(readAmsFile('server/src/index.js'));
  const rw = strip(readAmsFile('server/src/routes/rewards.js'));
  const rf = strip(readAmsFile('server/src/routes/referrals.js'));
  const tg = strip(readAmsFile('server/src/routes/marketerTargets.js'));
  h.check('§1 /api/rewards and /api/marketer-targets are mounted', /app\.use\('\/api\/rewards'/.test(idx) && /app\.use\('\/api\/marketer-targets'/.test(idx));
  h.check('§1 GET /rewards/mine: a marketer', /router\.get\('\/mine', auth, authorize\('marketer', 'teacher'\), c\.getMine\)/.test(rw));
  h.check('§1 POST /rewards/codes and /codes/check: a marketer', /router\.post\('\/codes', auth, authorize\('marketer', 'teacher'\), c\.issueCode\)/.test(rw) && /router\.post\('\/codes\/check', auth, authorize\('marketer', 'teacher'\), c\.checkRecipient\)/.test(rw));
  h.check('§1 POST /rewards/codes/:id/shared: the issuers, a marketer among them', /const ISSUERS = authorize\([^)]*'marketer'/.test(rw) && /router\.post\('\/codes\/:id\/shared', auth, ISSUERS, c\.markShared\)/.test(rw));
  h.check('§1 lead links: list and make (scoped by the AMS to her own)', /router\.get\('\/links', auth, getLeadLinks\)/.test(rf) && /router\.post\('\/links', auth, generateLeadLink\)/.test(rf) && /router\.get\('\/link-courses', auth, authorize\([^)]*'marketer'/.test(rf));
  h.check('§1 her referrals and their PDF: a marketer', /router\.get\('\/', auth, authorize\([^)]*'marketer'[^)]*\), getAllReferrals\)/.test(rf) && /router\.post\('\/pdf', auth, authorize\([^)]*'marketer'/.test(rf));
  h.check('§1 her target: any signed-in person, her own', /router\.get\('\/my-progress', auth, getMyProgress\)/.test(tg));
  h.check('§1 the app’s table names exactly these paths', MORE_API.rewardsMine.path === '/rewards/mine' && MORE_API.target.path === '/marketer-targets/my-progress' && MORE_API.referralsPdf.method === 'POST');

  // §2 Follow-ups: the AMS's own buckets
  const filter = strip(readAmsFile('server/src/services/prospectFilter.js'));
  const fu = /const FU_VALUES = \[([^\]]*)\]/.exec(filter)?.[1] ?? '';
  h.check('§2 every bucket is one the lead filter accepts (fu=)', BUCKETS.every((b) => fu.includes(`'${b.value}'`)) && BUCKETS.map((b) => b.value).join() === 'overdue,today,week', fu);
  h.check('§2 a bucket is one page of her leads by the AMS’s fu', new URLSearchParams(bucketPath('today').split('?')[1]).get('fu') === 'today');

  // §3 Give a coupon — what issueCode reads, and the website's message run beside the app's
  const rc = strip(readAmsFile('server/src/controllers/rewardsController.js'));
  const issue = declOf(rc, 'issueCode');
  h.check('§3 issueCode extracts (floor)', issue.length > 2000, String(issue.length));
  const cb = couponBody({ name: ' Sara Khalil ', phone: '+965 6012 3456', courseId: 'c1' });
  h.check('§3 the body: name, mobile and course as issueCode reads them', cb.ok && JSON.stringify(cb.body) === JSON.stringify({ to_name: 'Sara Khalil', to_phone: '+965 6012 3456', course_id: 'c1' }) && /b\.to_name/.test(issue) && /b\.to_phone/.test(issue) && /b\.course_id/.test(issue));
  h.check('§3 a short number is refused in the AMS’s own words', !couponBody({ name: 'x', phone: '123', courseId: null }).ok && (couponBody({ name: 'x', phone: '123', courseId: null }) as { message: string }).message === 'That phone number does not look right' && issue.includes('That phone number does not look right'));
  h.check('§3 no name or no mobile: nothing sent (the AMS refuses it too)', !couponBody({ name: '', phone: '+96560123456', courseId: null }).ok && !couponBody({ name: 'x', phone: ' ', courseId: null }).ok);
  h.check('§3 the terms line and the public site are the website’s', readAmsFile('client/src/lib/couponTerms.js').includes(`export const COUPON_TERMS = "${COUPON_TERMS}"`) && readAmsFile('client/src/lib/publicSite.js').includes(`export const PUBLIC_SITE = "${PUBLIC_SITE}"`));
  const ui = strip(readAmsFile('client/src/components/coupons/couponUi.js'));
  const srcShare = declOf(ui, 'shareText');
  const srcKd = declOf(ui, 'kdShort');
  const srcCard = declOf(ui, 'cardUrl');
  h.check('§3 the website’s shareText, kdShort and cardUrl extract', [srcShare, srcKd, srcCard].every((x) => x.length > 30));
  const ORIGIN = 'https://app.icsasystem.com';
  const day = (v: string) => `D(${v})`;
  const website = new Function('window', 'PUBLIC_SITE', 'COUPON_TERMS', 'day', `${srcKd}\n${srcCard}\n${srcShare}\nreturn { shareText, kdShort };`)({ location: { origin: ORIGIN } }, PUBLIC_SITE, COUPON_TERMS, day) as {
    shareText: (a: Record<string, unknown>) => string;
    kdShort: (n: unknown) => string;
  };
  const cases = [
    { code: 'SARA-7K2', discount: '5.000', validUntil: '2026-12-14', course: 'Graphics Designing Pro', firstName: 'Sara', id: 'c-1' },
    { code: 'AB12', discount: 2.5, validUntil: null, course: null, firstName: null, id: null },
  ];
  h.check('§3 the message sent with a code is the website’s, line for line', cases.every((c) => shareText({ ...c, origin: ORIGIN, day }) === website.shareText({ ...c })), shareText({ ...cases[0], origin: ORIGIN, day }));
  h.check('§3 kdShort is the website’s', [5, '2.500', 0, '12.345', null].every((n) => kdShort(n as number) === website.kdShort(n)));

  // §4 WhatsApp as the website opens it (lib/waLink.js run beside the app's)
  const wl = strip(readAmsFile('client/src/lib/waLink.js'));
  const wsrc = ['HOME_DIAL', 'HOME_LOCAL_RE', 'waNumber', 'waUrl', 'waShareUrl'].map((n) => declOf(wl, n));
  h.check('§4 the website’s waLink extracts', wsrc.every((x) => x.length > 10), wsrc.map((x) => x.length).join());
  const wa = new Function(`${wsrc.join('\n')}\nreturn { waNumber, waUrl, waShareUrl };`)() as { waNumber: (p: unknown) => string | null; waUrl: (p: unknown, n: unknown) => string | null; waShareUrl: (t: string, p: unknown) => string };
  const phones = ['55551234', '+965 5555 1234', '+91 98765 43210', '', null, '12'];
  h.check('§4 the number is the website’s', phones.every((p) => waNumber(p) === wa.waNumber(p)));
  h.check('§4 a lead’s chat opens with the website’s greeting', phones.every((p) => waUrl(p, 'Ahmed Al-Rashid') === wa.waUrl(p, 'Ahmed Al-Rashid')) && waUrl('55551234', null) === wa.waUrl('55551234', null));
  h.check('§4 a prepared message goes as the website sends it', waShareUrl('Hi! Code AB12', '+965 6012 3456') === wa.waShareUrl('Hi! Code AB12', '+965 6012 3456') && waShareUrl('x', null) === wa.waShareUrl('x', null));

  // §5 lead links — the address and the AMS's counts, in the website's words
  const ml = readAmsFile('client/src/pages/marketing/MyLinks.js');
  h.check('§5 a link opens the website’s apply page with its token', ml.includes('"https://icsa.us/apply?ref=" + token') && linkUrl('T0K3N') === 'https://icsa.us/apply?ref=T0K3N');
  const rctl = readAmsFile('server/src/controllers/referralsController.js');
  h.check('§5 `clicks` counts form submissions (the AMS says so), and the website calls them that', /`clicks` DOES NOT COUNT CLICKS/.test(rctl) && ml.includes('Form submits') && ml.includes('Leads created'));
  const link = { id: 'l', token: 't', course_label: null, clicks: 12, submissions: '9', enrolled: '2', is_active: true } as LeadLink;
  h.check('§5 the line says form submits and leads created — never "opens"', linkLine(link) === '12 form submits · 9 leads created' && !/open/i.test(linkLine(link)));

  // §6 the target — an enrolment count, no KD (Yasir, 14 Nov 2026)
  const tc = strip(readAmsFile('server/src/controllers/marketerTargetsController.js'));
  h.check('§6 my-progress answers the targets and the count this app reads', /target_org_wide,/.test(tc) && /targets_per_branch,/.test(tc) && /actual_count,/.test(tc));
  h.check('§6 the org-wide target first', JSON.stringify(targetOf({ period_month: '2026-11-01', target_org_wide: { target_count: 15 }, targets_per_branch: [{ target_count: 4 }], actual_count: 9 })) === '{"done":9,"of":15}');
  h.check('§6 else her branches’ targets; none set says so', targetOf({ period_month: null, target_org_wide: null, targets_per_branch: [{ target_count: 4 }, { target_count: 6 }], actual_count: 2 })?.of === 10 && targetOf({ period_month: null, target_org_wide: null, targets_per_branch: [], actual_count: 0 }) === null);
  h.check('§6 days left in the month (Kuwait days)', daysLeftInMonth('2026-11-14') === 16 && daysLeftInMonth('2026-02-28') === 0 && daysLeftInMonth('2028-02-28') === 1);
  const refScreen = strip(read('./MarketerReferralsScreen.tsx'));
  h.check('§6 the screen shows no KD target or amount', refScreen.length > 4000 && !/actual_amount|target_amount/.test(refScreen));

  // §7 referrals — the website's order (vendored verbatim), her own, no money
  const ven = read('../vendor/ams/referrals.ts');
  const marker = '// ── verbatim below ──\n';
  const amsLib = readAmsFile('client/src/lib/referrals.js');
  h.check('§7 the vendored referrals lib is the AMS’s, byte for byte', ven.includes(marker) && ven.slice(ven.indexOf(marker) + marker.length) === amsLib, String(amsLib.length));
  const R = (id: string, d: string, created: string): Referral => ({ id, student_name: id, course_name: null, enrollment_no: null, enrollment_status: null, student_status: null, attended: null, last_attended: null, referral_date: d, enrolled_date: null, status: 'approved', created_at: created });
  const m = thisMonth([R('a', '2026-11-03', '1'), R('b', '2026-11-10', '1'), R('c', '2026-10-31', '9'), R('d', '2026-11-10', '2')], '2026-11-14');
  h.check('§7 this month only, newest first, a later-created first on the same day (the No. of the website and its PDF)', m.from === '2026-11-01' && m.to === '2026-11-30' && m.rows.map((r) => r.id).join() === 'd,b,a');
  const pdfCtl = strip(readAmsFile('server/src/controllers/referralsPdfController.js'));
  h.check('§7 the PDF job is what the AMS reads (from, to, date_by, status, q)', Object.keys(pdfBody('2026-11-01', '2026-11-30')).every((k) => new RegExp(`b\\.${k}\\b`).test(pdfCtl)));
  h.check('§7 the PDF is named with house dates', pdfName('2026-11-01', '2026-11-30', (v) => v) === 'ICSA referrals 2026-11-01 – 2026-11-30.pdf');
  // A referral row is `r` on the screen; her own payout balance (wallet.balance) is hers, not a student's.
  h.check('§7 the screen draws its referrals as `r` (floor for the next line)', /month\.rows|rows\.map\(\(r, i\)/.test(refScreen));
  h.check('§7 no fee, paid, balance, moved or bonus is drawn from a referral (however it is reached)', !/\.(fee|paid|moved|bonus_amount|total_bonus)\b/.test(refScreen) && (refScreen.match(/\.balance\b/g) ?? []).length === (refScreen.match(/wallet\.balance\b/g) ?? []).length);

  // §8 wiring, and Yasir's rulings
  const tabs = read('../navigation/tabs.ts');
  for (const name of ['followups', 'new', 'referrals']) {
    const route = read(`../app/marketer/${name}.tsx`);
    h.check(`§8 marketer/${name} is built, its own screen`, new RegExp(`name: '${name}',[^\\n]*\\n?[^\\n]*phase: 4, built: true`).test(tabs.slice(tabs.indexOf('marketer: ['))) && route.includes(`Tab: marketer/${name}`) && !route.includes('TabPlaceholder'));
  }
  h.check('§8 her students’ follow-ups open the Follow-up Centre with a way back', existsSync(new URL('../app/student-followups.tsx', import.meta.url)) && /<FollowupsScreen back \/>/.test(read('../app/student-followups.tsx')));
  const newScreen = strip(read('./MarketerNewScreen.tsx'));
  h.check('§8 no lead is typed in (Yasir, 14 Nov 2026): New neither offers nor sends one', newScreen.length > 4000 && !/Add a lead/i.test(newScreen) && !/referrals\/prospects/.test(newScreen) && !/LEADS_API/.test(newScreen));
  const reg = strip(read('../reception/RegisterScreen.tsx'));
  h.check('§8 a marketer registers but is never offered Enrol (the AMS refuses her /enrollments/full)', /const reception = user\?\.role !== 'marketer';/.test(reg) && /\{reception \? <Button title="Enrol in a course"/.test(reg));
});
