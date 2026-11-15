import { readFileSync } from 'node:fs';

import { closeOf, declOf, readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';
import { strip } from '../../scripts/strip.ts';
import { COUPON_TERMS, PUBLIC_SITE, kdShort } from '../marketer/more.ts';

import {
  AMBASSADOR_API,
  LINE_KIND,
  STATUS_WORD,
  cardUrl,
  codeFor,
  createLabel,
  currentCode,
  day,
  footnote,
  friendLine,
  friendsOf,
  historyLine,
  homeCard,
  imageUrl,
  issueBody,
  monthLine,
  offerLine,
  progressPct,
  rewardOf,
  shareMessage,
  soonest,
  type Code,
} from './ambassador.ts';

// The Student Ambassador (15 Nov 2026), held to the AMS's routes and student
// firewall, to what GET /ambassador/me sends (a friend's progress, never their
// fee), to how a code is issued and shared, and to the website's own page —
// its message run beside the app's.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const ORIGIN = 'https://app.icsasystem.com';

const code = (over: Partial<Code> = {}): Code => ({
  id: 'c1', code: 'MARIA-7KQ2', status: 'issued', origin: null, friend_name: 'Sara Ahmed', friend_whatsapp: '98765432',
  valid_until: '2026-12-15T09:00:00.000Z', shared_at: null, discount_amount: 10, giver_kd: 10, giver_reward_kd: null,
  receiver_name: null, earns_on_any: null, paid_pct: null, ...over,
});

run('ambassador.check — the Student Ambassador as the AMS and the website run it', (h) => {
  // §1 the routes, the firewall, the public picture
  const idx = strip(readAmsFile('server/src/index.js'));
  const rt = strip(readAmsFile('server/src/routes/ambassador.js'));
  const fw = readAmsFile('server/src/middleware/studentFirewall.js');
  const cr = strip(readAmsFile('server/src/routes/coupons.js'));
  h.check('§1 mounted at /api/ambassador', /app\.use\('\/api\/ambassador', require\('\.\/routes\/ambassador'\)\)/.test(idx));
  h.check('§1 me, vouchers and shared: a student only', /router\.get\('\/me', auth, authorize\('student'\), either\(rewards\.getMine, getMyAmbassador\)\)/.test(rt) && /router\.post\('\/vouchers', auth, authorize\('student'\), either\(rewards\.issueCode, createMyVoucher\)\)/.test(rt) && /router\.post\('\/shared', auth, authorize\('student'\), either\(/.test(rt));
  h.check('§1 …and on the student firewall’s allowlist (default-deny for student tokens)', ['GET', '/api/ambassador/me', 'POST', '/api/ambassador/vouchers', '/api/ambassador/shared'].every((x) => fw.includes(`'${x}'`)) && /\{ method: 'POST', path: '\/api\/ambassador\/shared' \}/.test(fw));
  h.check('§1 the voucher picture and page are public (no sign-in, so no student token to refuse)', /router\.get\('\/:id\/image', getCouponImage\);/.test(cr) && /router\.get\('\/:id\/card', getCouponCard\);/.test(cr));
  h.check('§1 the app’s paths are those', AMBASSADOR_API.me.path === '/ambassador/me' && AMBASSADOR_API.issue.path === '/ambassador/vouchers' && AMBASSADOR_API.shared.path === '/ambassador/shared');

  // §2 what /me sends: a friend's progress, never their fee
  const rc = strip(readAmsFile('server/src/controllers/rewardsController.js'));
  const gm = declOf(rc, 'getMine');
  h.check('§2 getMine extracts (floor) and sends the rule, allowance, wallet and codes', gm.length > 1500 && /rule: rules\.roles\[role\], cooling_days: rules\.cooling_days/.test(gm) && /allowance,/.test(gm) && /wallet: \{ \.\.\.\(await balanceOf\(DB, holder\)\), lines: await walletLines\(DB, holder\)/.test(gm) && /codes: role === 'student' \? rows\.map\(forAmbassador\) : rows/.test(gm) && /name: me\.full_name/.test(gm));
  const fa = declOf(rc, 'forAmbassador');
  h.check('§2 a student’s codes lose the fee, the payments and the enrolment before they leave the AMS', ['paid_total', 'min_paid', 'discount_applied', 'enrollment_no', 'enrollment_id', 'receiver_code', 'enrol_course'].every((k) => new RegExp(`const \\{[^}]*\\b${k}\\b[^}]*\\.\\.\\.rest \\} = c;`).test(fa)) && /return \{ \.\.\.rest, paid_pct: pct \};/.test(fa));
  const codeSql = /const CODE_SQL = `([\s\S]*?)`;/.exec(rc)?.[1] ?? '';
  const statuses = [...codeSql.matchAll(/THEN '(\w+)'/g)].map((m) => m[1]).concat([...codeSql.matchAll(/ELSE '(\w+)'/g)].map((m) => m[1]));
  h.check('§2 every status a student can see has the website’s word', ['issued', 'shared', 'used', 'waiting', 'cooling', 'earned', 'refunded', 'expired', 'void'].every((s) => statuses.includes(s) && !!STATUS_WORD[s]), statuses.join());
  h.check('§2 the wallet is in KD: balance and on the way', /return \{ balance: round3\(w\.rows\[0\]\.n\), pending: round3\(p\.rows\[0\]\.kd\)/.test(rc));

  // §3 issuing a code: the friend's name and WhatsApp, checked before it is made
  const ic = declOf(rc, 'issueCode');
  h.check('§3 issueCode extracts (floor) and reads friend_name and friend_whatsapp', ic.length > 4000 && /String\(b\.to_name \|\| b\.friend_name \|\| ''\)/.test(ic) && /String\(b\.to_phone \|\| b\.friend_whatsapp \|\| ''\)/.test(ic));
  h.check('§3 both are required for a student, and a short number is refused', ic.includes(`"Enter your friend's name and WhatsApp number"`) && ic.includes("'That phone number does not look right'") && /R\.last8\(toPhone\)\.length < 8/.test(ic));
  h.check('§3 the month’s limit and a paused programme are refused before anything is made', /if \(allowance\.blocked\) return res\.status\(409\)\.json\(\{ error: allowance\.blocked \}\);/.test(ic) && /Issuing coupons is switched off for /.test(rc));
  h.check('§3 a friend already known, or holding a live code, is refused when the code is made', /const refused = await personRefusal\(client, \{ role, req, toPhone, rules \}\);/.test(ic) && /const dup = await liveCodeRefusal\(client, toPhone\);/.test(ic));
  const ib = issueBody('  Noor Khalid ', ' 9123 4567 ');
  h.check('§3 the app sends them trimmed — and never a short number', ib.ok && JSON.stringify(ib.body) === '{"friend_name":"Noor Khalid","friend_whatsapp":"9123 4567"}' && !issueBody('', '91234567').ok && !issueBody('Noor', '912 3456').ok && !issueBody('Noor', '912 345').ok && issueBody('Noor', '9123 4567').ok);
  h.check('§3 sharing is said with the code’s id in the body', /req\.params\.id = \(req\.body \|\| \{\}\)\.id;/.test(rt) && /UPDATE coupons SET shared_at = COALESCE\(shared_at, now\(\)\)/.test(declOf(rc, 'markShared')));

  // §4 the website's page, word for word — its message RUN beside the app's
  const web = readAmsFile('client/src/pages/student/StudentAmbassador.js');
  const at = web.indexOf('const shareMessage = (c) => {');
  const end = at < 0 ? -1 : closeOf(web, web.indexOf('{', at));
  const kdSrc = /const kd = \(n\) => ("KD " \+ Number\(n \|\| 0\)\.toFixed\(3\)\.replace\(\/\\\.\?0\+\$\/, ""\));/.exec(web)?.[1] ?? '';
  h.check('§4 the website’s message and its KD were found (floor)', at > 0 && end > at && kdSrc.length > 30);
  let webMessage: ((c: unknown) => string) | null = null;
  try {
    // closeOf answers the place AFTER the closing brace.
    const body = web.slice(web.indexOf('{', at) + 1, end - 1);
    webMessage = new Function('kd', 'voucherCard', 'day', 'PUBLIC_SITE', 'COUPON_TERMS', `return (c) => {${body}};`)(
      new Function('n', `return ${kdSrc};`), (id: string) => cardUrl(ORIGIN, id), day, PUBLIC_SITE, COUPON_TERMS) as (c: unknown) => string;
  } catch (err) {
    h.check(`§4 the website’s message runs: ${err instanceof Error ? err.message : String(err)}`, false);
  }
  const samples = [code(), code({ friend_name: null, valid_until: null, discount_amount: 7.5 }), code({ friend_name: '  Ali   Hassan ', discount_amount: 12.25 })];
  h.check('§4 the app’s message is the website’s, character for character', !!webMessage && samples.every((s) => webMessage!(s) === shareMessage(s, ORIGIN)), webMessage ? JSON.stringify(shareMessage(samples[0], ORIGIN)).slice(0, 120) : 'no website function');
  h.check('§4 the voucher page and picture are the website’s', /const voucherCard = \(id\) => window\.location\.origin \+ "\/api\/coupons\/" \+ id \+ "\/card\?p=tall";/.test(web) && cardUrl(ORIGIN, 'x') === `${ORIGIN}/api/coupons/x/card?p=tall` && /const urlOf = \(id, story, ver\) => "\/api\/coupons\/" \+ id \+ "\/image\?v=3"/.test(readAmsFile('client/src/components/coupons/VoucherShare.js')) && imageUrl(ORIGIN, 'x') === `${ORIGIN}/api/coupons/x/image?v=3&size=story` && /req\.query\.size === 'story'/.test(readAmsFile('server/src/controllers/couponsController.js')));
  const webStatus = Object.fromEntries([...web.matchAll(/^\s+(\w+):\s+\{ label: "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
  h.check('§4 the status words are the website’s', Object.keys(webStatus).length === 9 && Object.entries(webStatus).every(([k, v]) => STATUS_WORD[k]?.label === v), JSON.stringify(webStatus));
  const webKind = /const KIND = \{([^}]*)\};/.exec(web)?.[1] ?? '';
  h.check('§4 the reward-history words are the website’s', Object.entries(LINE_KIND).every(([k, v]) => webKind.includes(`${k}: "${v}"`)) && (webKind.match(/: "/g) ?? []).length === Object.keys(LINE_KIND).length);
  h.check('§4 which code to share and who counts as a friend: the website’s filters', web.includes('const current = codes.find((c) => !isOld(c) && ["issued", "shared"].includes(c.status));') && web.includes('const friends = codes.filter((c) => c.receiver_name || c.status !== "issued" || isOld(c));'));
  const all = [code({ id: 'a', status: 'earned', receiver_name: 'Fatima Ali' }), code({ id: 'b', status: 'shared' }), code({ id: 'c', status: 'issued' }), code({ id: 'd', status: 'issued', origin: 'old_system' })];
  h.check('§4 …run on a table: the newest unused code, never an old-system one; friends are the rest', currentCode(all)?.id === 'b' && currentCode([all[3]]) === null && friendsOf(all).map((c) => c.id).join('') === 'abd');
  for (const phrase of ['" earned"', '"Paid enough ✓ — your "', '" arrives "', '"Paid " + Math.min(100, c.paid_pct) + "% of what\'s needed — your "', '"Waiting for their first payment — your "', '" comes " + (data.cooling_days || 0) + " days after they reach it"', '" after their first payment"', '"Code shared " + day(c.shared_at) + " · not used yet"', '"Expired " + day(c.valid_until)']) {
    h.check(`§4 the friend line’s words are the website’s: ${phrase.slice(0, 40)}`, web.includes(phrase));
  }
  h.check('§4 …and the app says them', friendLine(code({ status: 'earned', giver_reward_kd: 10 }), 14) === 'KD 10 earned' && friendLine(code({ status: 'cooling', earns_on_any: '2026-11-22' }), 14) === 'Paid enough ✓ — your KD 10 arrives 22 Nov 2026' && friendLine(code({ status: 'waiting', paid_pct: 60 }), 14) === "Paid 60% of what's needed — your KD 10 comes 14 days after they reach it" && friendLine(code({ status: 'waiting', paid_pct: 0 }), null) === 'Waiting for their first payment — your KD 10 comes 0 days after they reach it' && friendLine(code({ status: 'used' }), 14) === 'KD 10 after their first payment' && friendLine(code({ status: 'shared', shared_at: '2026-11-13T22:30:00.000Z' }), 14) === 'Code shared 14 Nov 2026 · not used yet' && friendLine(code({ status: 'expired', valid_until: '2026-11-01T08:00:00.000Z' }), 14) === 'Expired 1 Nov 2026');
  h.check('§4 the footnote is the website’s', web.includes('after your friend has paid enough on their course. A refund takes it back. We never show your friend\'s fee or payments — only the progress.') && footnote(14) === "Your reward is earned 14 days after your friend has paid enough on their course. A refund takes it back. We never show your friend's fee or payments — only the progress." && footnote(0).startsWith('Your reward is earned after'));
  h.check('§4 the form’s words are the website’s', web.includes('"Enter your friend\'s name"') && web.includes('"Enter your friend\'s WhatsApp number (8 digits)"') && web.includes('"Create code" + (name.trim() ? " for " + name.trim().split(/\\s+/)[0] : "")') && web.includes('Codes this month: {a.issued_this_month || 0} of {a.cap || 0}') && createLabel(' Noor Khalid') === 'Create code for Noor' && createLabel('') === 'Create code' && monthLine({ issued_this_month: 1, cap: 5, blocked: null }) === 'Codes this month: 1 of 5' && monthLine(null) === 'Codes this month: 0 of 0');

  // §5 the app's own lines
  h.check('§5 the reward of a code: what it earned, else what it was issued with', rewardOf({ giver_reward_kd: 12, giver_kd: 10 }) === 12 && rewardOf({ giver_reward_kd: null, giver_kd: 10 }) === 10);
  h.check('§5 a waiting friend’s bar never shows less than a sliver or more than full; others have none', progressPct({ status: 'waiting', paid_pct: 0 }) === 2 && progressPct({ status: 'waiting', paid_pct: 140 }) === 100 && progressPct({ status: 'earned', paid_pct: 100 }) === null);
  h.check('§5 the soonest reward on its way', soonest([code({ id: 'x', status: 'cooling', earns_on_any: '2026-11-30' }), code({ id: 'y', status: 'cooling', earns_on_any: '2026-11-22' }), code({ id: 'z', status: 'earned' })])?.id === 'y' && soonest([]) === null);
  h.check('§5 the offer and who the code is for', offerLine({ rule: { discount: 10, reward_kd: 10 } }) === 'Give a friend KD 10 off — you get KD 10 when they join and pay.' && codeFor(code()) === 'For Sara Ahmed · 98765432 · valid until 15 Dec 2026' && codeFor(code({ friend_name: null, friend_whatsapp: null, valid_until: null })) === "For anyone who isn't an ICSA student yet");
  h.check('§5 reward history: + and −, short KD', JSON.stringify(historyLine({ id: '1', amount_kd: 10, kind: 'earn', note: null, created_at: '2026-11-08T10:00:00.000Z' })) === '{"left":"8 Nov 2026 · Earned","right":"+ KD 10","minus":false}' && historyLine({ id: '2', amount_kd: -5.5, kind: 'payout', note: 'cash', created_at: '2026-11-09T10:00:00.000Z' }).right === '− KD 5.5');
  h.check('§5 Home’s card: the offer and what you earned — or the website’s words until the AMS answers', JSON.stringify(homeCard({ rule: { discount: 10, reward_kd: 10 }, wallet: { balance: 20, pending: 0, lines: [] } })) === '{"title":"Give a friend KD 10 off","sub":"You get KD 10 when they join and pay.","earned":"KD 20"}' && JSON.stringify(homeCard(null)) === '{"title":"Ambassador programme","sub":"Invite a friend — they save on their first course","earned":null}' && read('../../' + 'scripts/strip.ts').length > 0 && readAmsFile('client/src/pages/student/StudentHome.js').includes('Invite a friend — they save on their first course'));
  h.check('§5 short KD is the coupon world’s own (kdShort, held to the AMS by more.check)', kdShort(10) === 'KD 10' && kdShort(7.5) === 'KD 7.5');

  // §6 wiring
  const scr = strip(read('./AmbassadorScreen.tsx'));
  const home = strip(read('./HomeScreen.tsx'));
  h.check('§6 the route is its own screen', /return <AmbassadorScreen \/>;/.test(read('../app/ambassador.tsx')));
  h.check('§6 Home reads the programme and opens it', /const amb = useAmsGet<Mine>\(AMBASSADOR_API\.me\.path, live\);/.test(home) && /router\.push\('\/ambassador'\)/.test(home) && /amb\.refresh\(\);/.test(home));
  h.check('§6 Send on WhatsApp: the website’s message to the friend’s number, then said as shared', /await Linking\.openURL\(waShareUrl\(shareMessage\(c, AMS_WEB_URL\), c\.friend_whatsapp\)\);\s*markShared\(c\);/.test(scr) && /ams\.request\('POST', AMBASSADOR_API\.shared\.path, \{ id: c\.id \}\)/.test(scr));
  h.check('§6 …and so is a shared picture', /await Sharing\.shareAsync\(file\.uri, [^;]*\);\s*markShared\(c\);/.test(scr));
  h.check('§6 Share the picture: the Status-size picture to the share sheet, with no sign-in sent', /File\.downloadFileAsync\(imageUrl\(AMS_WEB_URL, c\.id\), dest, \{ headers: \{ Accept: 'image\/png' \}, idempotent: true \}\)/.test(scr) && !/Authorization/.test(scr) && /Sharing\.shareAsync\(file\.uri, \{ mimeType: 'image\/png'/.test(scr));
  h.check('§6 a new code: issueBody’s body, and the AMS’s refusal shown as it says it', /const b = issueBody\(name, phone\);/.test(scr) && /ams\.request<[^>]*>\('POST', AMBASSADOR_API\.issue\.path, b\.body\)/.test(scr) && /setOutcome\(\{ tone: 'danger', text: r\.failure\.message \}\)/.test(scr));
  h.check('§6 the month’s limit or a paused programme replaces the form with the AMS’s words', /\{a\?\.blocked \? \(/.test(scr));
});
