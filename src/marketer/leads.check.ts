import { existsSync, readFileSync } from 'node:fs';

import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';
import { strip } from '../../scripts/strip.ts';

import {
  LEADS_API,
  MOVES,
  OUTCOMES,
  STAGES,
  WHEN_OPTIONS,
  WRONG_NUMBER,
  addDays,
  headerFigures,
  leadLine,
  listPath,
  logBody,
  offeredReasons,
  stageChips,
  type Lead,
  type ListAnswer,
} from './leads.ts';

// Marketers, bunch 1 (14 Nov 2026): My leads and one lead, held to the AMS's
// routes (routes/referrals.js), controllers (getProspects, updateProspectStatus,
// logProspectFollowup), the lead filter (services/prospectFilter.js), the
// website's LogContactForm and the vendored lib/leadExpiry.js.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
/** The JS array literal assigned to `name`, evaluated (strings and plain objects only). */
function arrayOf(src: string, name: string): unknown[] | null {
  const m = new RegExp(`(?:export\\s+)?const ${name} = (\\[[\\s\\S]*?\\n\\]);`).exec(src);
  if (!m) return null;
  try {
    return new Function('WRONG_NUMBER', `return ${m[1]};`)(WRONG_NUMBER) as unknown[];
  } catch {
    return null;
  }
}

run('leads.check — My leads and one lead, as the AMS keeps them (Marketers bunch 1)', (h) => {
  // §0 the extractor finds an array, and says so when it does not
  h.check('§0 arrayOf reads an array literal', JSON.stringify(arrayOf('const X = [\n  "a",\n  { b: 1 },\n];', 'X')) === '["a",{"b":1}]');
  h.check('§0 arrayOf answers null for a name that is not there', arrayOf('const X = [\n];', 'Y') === null);

  // §1 the routes, open to a marketer, under /api/referrals
  const routes = strip(readAmsFile('server/src/routes/referrals.js'));
  const idx = strip(readAmsFile('server/src/index.js'));
  h.check('§1 /api/referrals is mounted', /app\.use\('\/api\/referrals'/.test(idx));
  const open = (method: string, path: string) => new RegExp(`router\\.${method}\\('${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}', auth, authorize\\([^)]*'marketer'[^)]*\\)`).test(routes);
  for (const [k, e] of Object.entries(LEADS_API)) {
    const sub = e.path.replace(/^\/referrals/, '');
    h.check(`§1 ${e.method} ${e.path} is routed and open to a marketer (${k})`, open(e.method.toLowerCase(), sub));
  }

  // §2 the stages — the AMS's four (Yasir, 14 Nov 2026), and nothing the AMS does not have
  const ctrl = strip(readAmsFile('server/src/controllers/referralsController.js'));
  const settable = /\[('new', 'contacted', 'enrolled', 'lost')\]\.includes\(status\)/.exec(ctrl)?.[1];
  h.check('§2 updateProspectStatus accepts exactly new, contacted, enrolled, lost', settable === "'new', 'contacted', 'enrolled', 'lost'", String(settable));
  h.check('§2 the app shows exactly those four, in that order', STAGES.map((s) => s.value).join() === 'new,contacted,enrolled,lost');
  h.check('§2 no "Interested" or "Visited" stage (mockup 14 drew them; the AMS has neither)', !STAGES.some((s) => /interested|visited/i.test(s.label)));
  const filterSrc = strip(readAmsFile('server/src/services/prospectFilter.js'));
  const stageValues = /const STAGE_VALUES = \[([^\]]*)\]/.exec(filterSrc)?.[1] ?? '';
  h.check('§2 every stage is one the list filter accepts', STAGES.every((s) => stageValues.includes(`'${s.value}'`)), stageValues);

  // §3 logging a contact — the website's LogContactForm, word for word
  const form = readAmsFile('client/src/components/marketing/LogContactForm.js');
  h.check('§3 the wrong-number outcome is the website’s and the server’s words', form.includes(`export const WRONG_NUMBER = "${WRONG_NUMBER}"`) && ctrl.includes(`const WRONG_NUMBER_OUTCOME = '${WRONG_NUMBER}'`));
  const amsOutcomes = arrayOf(form, 'OUTCOMES');
  h.check('§3 the outcomes are the website’s, in its order', JSON.stringify(amsOutcomes) === JSON.stringify([...OUTCOMES]), JSON.stringify(amsOutcomes));
  const amsMoves = arrayOf(form, 'MOVES');
  h.check('§3 the moves (to Enrolled, to Lost) are the website’s', JSON.stringify(amsMoves) === JSON.stringify(MOVES), JSON.stringify(amsMoves));
  const amsWhen = arrayOf(form, 'WHEN_OPTIONS');
  h.check('§3 the follow-up choices are the website’s', JSON.stringify(amsWhen) === JSON.stringify(WHEN_OPTIONS), JSON.stringify(amsWhen));
  const logFn = ctrl.slice(ctrl.indexOf('const logProspectFollowup'), ctrl.indexOf('const logProspectFollowup') + 6000);
  const reads = /const \{ ([^}]*) \} = req\.body;/.exec(logFn)?.[1].split(',').map((x) => x.trim()) ?? [];
  h.check('§3 the AMS reads every field the log sends', reads.length >= 5 && ['outcome', 'note', 'next_followup_date', 'status', 'lost_reason'].every((k) => reads.includes(k)), reads.join());
  h.check('§3 only the owner may log — the AMS refuses anyone else', /You can only log follow-ups on your own leads\./.test(logFn));
  const T = '2026-11-14';
  const ok = logBody({ choice: 'Called - reached', note: ' Wants the evening batch ', when: '3', picked: null, lostReason: '', today: T });
  h.check('§3 a call logged: outcome, the note trimmed, the follow-up 3 days on (Kuwait days)', ok.ok && JSON.stringify(ok.body) === JSON.stringify({ outcome: 'Called - reached', note: 'Wants the evening batch', next_followup_date: '2026-11-17' }));
  const lost = logBody({ choice: 'move:lost', note: 'Joined elsewhere', when: '3', picked: null, lostReason: 'competitor', today: T });
  h.check('§3 moved to Lost: the move’s outcome, the stage, the reason, and no follow-up date', lost.ok && JSON.stringify(lost.body) === JSON.stringify({ outcome: 'Moved to Lost', note: 'Joined elsewhere', next_followup_date: null, status: 'lost', lost_reason: 'competitor' }));
  h.check('§3 Lost with no reason is not sent', !logBody({ choice: 'move:lost', note: 'x', when: '3', picked: null, lostReason: '', today: T }).ok);
  h.check('§3 no note, nothing sent (the website’s form will not send one either)', !logBody({ choice: 'WhatsApp sent', note: '  ', when: '3', picked: null, lostReason: '', today: T }).ok);
  const pick = logBody({ choice: 'WhatsApp sent', note: 'sent outline', when: 'pick', picked: '2026-12-01', lostReason: '', today: T });
  h.check('§3 a picked date is sent as picked; no date picked is said, not sent', pick.ok && (pick.body as { next_followup_date: string }).next_followup_date === '2026-12-01' && !logBody({ choice: 'WhatsApp sent', note: 'x', when: 'pick', picked: null, lostReason: '', today: T }).ok);
  h.check('§3 "No follow-up date" sends none', (() => { const b = logBody({ choice: 'Other', note: 'x', when: 'none', picked: null, lostReason: '', today: T }); return b.ok && b.body.next_followup_date === null; })());
  h.check('§3 days are counted on the calendar (month and year ends)', addDays('2026-11-30', 1) === '2026-12-01' && addDays('2026-12-25', 14) === '2027-01-08');

  // §4 the list: the parameters the AMS reads, one page at a time, and its own counts
  const lp = new URLSearchParams(listPath('contacted', 'ahmed', 2).split('?')[1]);
  h.check('§4 the list asks by stage, search, page and page size', lp.get('stage') === 'contacted' && lp.get('search') === 'ahmed' && lp.get('page') === '2' && lp.get('page_size') === '50' && !new URLSearchParams(listPath('all', null).split('?')[1]).has('stage'));
  const maxPage = Number(/const PAGE_SIZE_MAX = (\d+);/.exec(ctrl)?.[1]);
  h.check('§4 …which the AMS reads (search, stage, page, page_size ≤ its maximum)', /query\.search/.test(filterSrc) && /query\.stage/.test(filterSrc) && /req\.query\.page_size/.test(ctrl) && maxPage >= 50);
  h.check('§4 the AMS answers the stage and schedule counts the figures are drawn from', /counts: \{ stage,/.test(ctrl) && /\{ overdue: 0, today: 0, week: 0, later: 0, nodate: 0/.test(ctrl));
  const ans = { prospects: [], total: 31, total_pages: 1, page: 1, counts: { stage: { new: 6, contacted: 9, enrolled: 13, lost: 3 }, schedule: { overdue: 1, today: 3 } } } as ListAnswer;
  h.check('§4 the figures are the AMS’s counts, never the rows added up', JSON.stringify(headerFigures(ans).map((f) => f.value)) === '[6,4,13]' && headerFigures(null).length === 0);
  h.check('§4 the chips say the AMS’s counts', stageChips(ans).map((c) => c.label).join('|') === 'All 31|New 6|Contacted 9|Enrolled 13|Lost 3');

  // §5 expiry — the AMS's lib, vendored byte for byte; the list line reads it
  const ven = read('../vendor/ams/leadExpiry.ts');
  const marker = '// ── verbatim below ──\n';
  const amsLib = readAmsFile('client/src/lib/leadExpiry.js');
  h.check('§5 the vendored leadExpiry is the AMS’s, byte for byte', ven.includes(marker) && ven.slice(ven.indexOf(marker) + marker.length) === amsLib, String(amsLib.length));
  const base: Lead = {
    id: 'p', full_name: 'Ahmed', phone: '+96555551234', whatsapp: null, status: 'new', course_interest_name: null, branch_interest_name: null, referred_by_name: null,
    created_at: '2026-11-13T10:00:00Z', next_followup_date: null, last_contact_at: null, last_note: null, last_activity_at: null, is_contacted: false, wrong_number_at: null,
    lost_reason: null, attributed_enrollment_no: null, expires_at: null, days_to_expiry: null, is_expired: null,
  };
  const day = (x: string) => x;
  h.check('§5 a fresh lead: "New — not contacted"', leadLine(base, T, day).text === 'New — not contacted');
  h.check('§5 the AMS’s expiry clock wins when it is close', leadLine({ ...base, expires_at: '2026-11-17', days_to_expiry: 3 }, T, day).text === 'Expires in 3 days');
  h.check('§5 expired is said', leadLine({ ...base, expires_at: '2026-11-10', days_to_expiry: -4 }, T, day).text === 'Expired');
  h.check('§5 a call due today, and one overdue', leadLine({ ...base, status: 'contacted', is_contacted: true, next_followup_date: T }, T, day).text === 'Call today' && leadLine({ ...base, status: 'contacted', next_followup_date: '2026-11-10' }, T, day).tone === 'danger');
  h.check('§5 enrolled names its enrolment; lost and refunded are said', leadLine({ ...base, status: 'enrolled', attributed_enrollment_no: 'EN-021051' }, T, day).text === 'Enrolled · EN-021051' && leadLine({ ...base, status: 'lost' }, T, day).text === 'Lost' && /refunded/.test(leadLine({ ...base, status: 'enrolled_refunded' }, T, day).text));

  // §6 lost reasons: the AMS's list, the switched-off ones left out
  h.check('§6 the reasons offered leave out the ones switched off', offeredReasons([{ key: 'fee', label: 'Fee too high' }, { key: 'x', label: 'Old', active: false }]).map((r) => r.key).join() === 'fee' && offeredReasons(null).length === 0);
  h.check('§6 the AMS answers { reasons } and the website keys them by key/label', /res\.json\(\{ reasons: all \}\)/.test(ctrl) && /\{ key: "fee", label: "Fee too high" \}/.test(readAmsFile('client/src/lib/lostReasons.js')));

  // §7 wiring, and no money on a marketer's screens (8 Nov 2026)
  h.check('§7 My leads is the marketer’s first tab, built', /name: 'index', label: 'Leads'[^\n]*\n?[^\n]*phase: 4, built: true/.test(read('../navigation/tabs.ts')) && read('../app/marketer/index.tsx').includes('Tab: marketer/index') && !read('../app/marketer/index.tsx').includes('TabPlaceholder'));
  h.check('§7 one lead has its route', existsSync(new URL('../app/lead.tsx', import.meta.url)));
  const screens = strip(read('./LeadsScreen.tsx')) + strip(read('./LeadScreen.tsx'));
  h.check('§7 the screens read (floor)', screens.length > 8000, String(screens.length));
  h.check('§7 no fee or paid figure is drawn on a marketer’s lead screens', !/attributed_fee|attributed_paid|enrolled_fee|enrolled_paid/.test(screens));
});
