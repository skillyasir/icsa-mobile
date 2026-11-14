import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { amsDir, readAmsFile } from '../../scripts/ams.ts';
import { runAsync } from '../../scripts/check-harness.ts';

import { IDEMPOTENT_ROUTES, PressKey } from '../api/idempotency.ts';
import * as VENDORED from '../vendor/ams/countries.ts';

import {
  COUNTRIES,
  EMPTY_REGISTER,
  IN_PROGRESS_WORDS,
  MONEY_API,
  NATIONALITIES,
  PROOF_UPLOAD_FIELD,
  REGISTER_REQUIRED,
  buildInstallmentItems,
  dialPrefix,
  enrolBody,
  houseDay,
  isPrefixOnly,
  isValidDateStr,
  nextInstalment,
  normalizeDays,
  owing,
  parseClock,
  parseHouseDate,
  paymentBody,
  receiptFileName,
  registerBody,
  settlePress,
  splitNetIntoInstallments,
  toDateStr,
  toPaidNow,
  validateEnrollment,
  validateInstallmentCount,
  validatePayment,
  type EnrolInput,
  type PaymentPlan,
  type Summary,
} from './money.ts';

// Reception 2b (14 Nov 2026): register, enrol, take a payment, the receipt —
// held to the AMS. The enrolment and payment code is the AMS's own
// client/src/lib (enrollmentFlow, installments, dates, phonePrefix,
// utils/constants): this check EXTRACTS those functions from the AMS copy on
// the Mac, RUNS them, and requires the app's copies to give the same answers
// on the same inputs — including the exact body POST /enrollments/full is sent.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Index just past the bracket that closes the one at `i`, skipping strings, templates and comments. */
function closeOf(src: string, i: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '/' && src[k + 1] === '/') {
      k = src.indexOf('\n', k);
      if (k < 0) return -1;
      continue;
    }
    if (c === '/' && src[k + 1] === '*') {
      k = src.indexOf('*/', k) + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      k++;
      while (k < src.length && src[k] !== c) {
        if (src[k] === '\\') k++;
        k++;
      }
      continue;
    }
    if (c === '`') {
      k++;
      while (k < src.length && src[k] !== '`') {
        if (src[k] === '\\') k += 2;
        else if (src[k] === '$' && src[k + 1] === '{') k = closeOf(src, k + 1);
        else k++;
      }
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return k + 1;
    }
  }
  return -1;
}

/** A top-level declaration's whole source by name: `[export] [async] function name(…) {…}` or `[export] const name = …;`. */
function declOf(src: string, name: string): string {
  const fn = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if (fn) {
    const paramsEnd = closeOf(src, fn.index + fn[0].length - 1);
    if (paramsEnd < 0) return '';
    const open = src.indexOf('{', paramsEnd);
    const end = closeOf(src, open);
    return end < 0 ? '' : src.slice(fn.index, end).replace(/^export\s+/, '');
  }
  const cn = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=`).exec(src);
  if (!cn) return '';
  for (let k = cn.index + cn[0].length; k < src.length; k++) {
    const c = src[k];
    if (c === '(' || c === '[' || c === '{') {
      const e = closeOf(src, k);
      if (e < 0) return '';
      k = e - 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // a string at the top level of the expression: skip to its closing quote
      k++;
      while (k < src.length && src[k] !== c) {
        if (src[k] === '\\') k++;
        k++;
      }
      continue;
    }
    if (c === ';') return src.slice(cn.index, k + 1).replace(/^export\s+/, '');
  }
  return '';
}

const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]])) : x));

runAsync('money.check — register, enrol, take a payment, the receipt (Reception 2b)', async (h) => {
  // §0 the extractor itself, on the awkward shapes first (a destructured parameter, strings holding brackets, an arrow with a block)
  const sample = [
    "export function a({ x = 1, y }) { const s = 'a ( { [ '; return x + y; }",
    'const b = (p) =>\n  p ? "}" : `${p}{`;',
    'export const c = (input) => {\n  if (!input) return "";\n  return [1, 2].map((t) => t);\n};',
    'async function d(q) { return `${q.map((z) => ({ z }))}`; }',
  ].join('\n');
  h.check('§0 a function past its destructured parameter', declOf(sample, 'a').endsWith('return x + y; }'), declOf(sample, 'a'));
  h.check('§0 an arrow const with brackets in its strings, to its semicolon', declOf(sample, 'b') === 'const b = (p) =>\n  p ? "}" : `${p}{`;', declOf(sample, 'b'));
  h.check('§0 an arrow const with a block body', declOf(sample, 'c').endsWith('t);\n};') && !declOf(sample, 'c').startsWith('export'));
  h.check('§0 an async function with a template holding braces', declOf(sample, 'd').endsWith('}))}`; }'), declOf(sample, 'd'));
  h.check('§0 a name that is not there is empty, never a guess', declOf(sample, 'zz') === '');

  // §1 the AMS routes these screens call, and who may call them
  const routes = (f: string) => strip(readAmsFile(`server/src/routes/${f}.js`));
  const idx = strip(readAmsFile('server/src/index.js'));
  const st = routes('students');
  h.check('§1 POST /students: supervisor allowed, wrapped (one press, one write)', /router\.post\('\/', auth, authorize\([^)]*'supervisor'[^)]*\), idempotent, ctrl\.createStudent\)/.test(st));
  h.check('§1 GET /students/duplicate-check: supervisor allowed', /router\.get\('\/duplicate-check', auth, authorize\([^)]*'supervisor'[^)]*\), ctrl\.duplicateCheck\)/.test(st));
  const en = routes('enrollments');
  h.check('§1 POST /enrollments/full: manager and supervisor, wrapped', /router\.post\('\/full', auth, authorize\('manager', 'supervisor'\),\s*idempotent, createEnrollmentFull\)/.test(en));
  h.check('§1 GET /enrollments/:id/receipt.pdf is routed', /router\.get\('\/:id\/receipt\.pdf', auth, getReceiptPdf\)/.test(en));
  const pay = routes('payments');
  h.check('§1 POST /payments: manager and supervisor, wrapped', /router\.post\('\/',\s*auth, authorize\('manager', 'supervisor'\), idempotent, recordPayment\)/.test(pay));
  const up = routes('uploads');
  h.check(
    '§1 POST /uploads/payment-proof: supervisor allowed, the file in the field this app sends',
    /'\/payment-proof'/.test(up) && /authorize\([^)]*'supervisor'/.test(up) && up.includes(`upload.single('${PROOF_UPLOAD_FIELD}')`) && /app\.use\('\/api\/uploads', require\('\.\/routes\/uploads'\)\)/.test(idx),
  );
  const co = routes('courses');
  h.check(
    '§1 the course list, its batches and its teachers are routed',
    /router\.get\('\/', auth, getAllCourses\)/.test(co) && /router\.get\('\/:id\/schedules', auth, getSchedules\)/.test(co) && /router\.get\('\/:id\/teachers', auth, getCourseTeachers\)/.test(co),
  );
  h.check('§1 GET /payment-methods: supervisor allowed', /router\.get\('\/',\s*auth, authorize\([^)]*'supervisor'[^)]*\), getAllMethods\)/.test(routes('paymentMethods')));
  const money = [MONEY_API.register.path, MONEY_API.enrol.path, MONEY_API.pay.path];
  h.check('§1 the three money writes are routes that take a key', money.every((p) => (IDEMPOTENT_ROUTES as readonly string[]).includes(p)));

  // §2 Register — the AMS's required fields, in its order and its words; nothing sent that it does not read
  const ctrl = strip(readAmsFile('server/src/controllers/studentsController.js'));
  const create = declOf(ctrl, 'createStudent');
  h.check('§2 createStudent extracts (floor)', create.length > 3000, String(create.length));
  const amsMissing = [...create.matchAll(/missing\.push\('([^']+)'\)/g)].map((m) => m[1]);
  h.check('§2 the required fields are the AMS’s, in its order', amsMissing.join('|') === REGISTER_REQUIRED.map(([, l]) => l).join('|'), amsMissing.join('|'));
  const amsField: Record<string, string> = {};
  for (const m of create.matchAll(/if \(!(\w+)[^\n]*?\) missing\.push\('([^']+)'\)/g)) amsField[m[2]] = m[1];
  const emailField = /if \(!(\w+) \|\| !String\(\1\)\.trim\(\)\) \{\s*missing\.push\('Email'\)/.exec(create)?.[1];
  if (emailField) amsField.Email = emailField;
  h.check('§2 …each label on the same field', REGISTER_REQUIRED.every(([k, l]) => amsField[l] === k), JSON.stringify(amsField));
  const destructured = /const \{([\s\S]*?)\} = req\.body;/.exec(create)?.[1].split(',').map((x) => x.trim()).filter(Boolean) ?? [];
  const full: typeof EMPTY_REGISTER = {
    ...EMPTY_REGISTER,
    full_name: ' Maria Santos ',
    national_id: '290010112345',
    date_of_birth: '14 Nov 1995',
    nationality: 'Filipino',
    gender: 'Female',
    phone: '+965 5555 1234',
    whatsapp: '+965 ',
    email: 'maria@example.com',
  };
  const reg = registerBody(full, 'b1');
  h.check(
    '§2 the AMS reads every field this app sends (no field silently dropped)',
    destructured.length > 15 && Object.keys(reg.body).every((k) => destructured.includes(k)),
    Object.keys(reg.body).filter((k) => !destructured.includes(k)).join() || 'all read',
  );
  h.check('§2 a complete form is sent, trimmed, the date as the AMS stores it', reg.problem === null && reg.body.full_name === 'Maria Santos' && reg.body.date_of_birth === '1995-11-14' && reg.body.branch_id === 'b1');
  h.check('§2 a phone box holding only the prefix is sent empty (the website’s rule)', reg.body.whatsapp === '' && reg.body.phone === '+965 5555 1234');
  h.check('§2 no joining date is sent — the AMS stores today (7 Nov 2026 ruling)', !('date_of_joining' in reg.body));
  const missingTwo = registerBody({ ...full, email: '', phone: '+965 ' }, 'b1');
  h.check('§2 missing fields are named as the AMS names them', missingTwo.problem === 'Phone, Email are required', String(missingTwo.problem));
  h.check('§2 one missing field: "is required"', registerBody({ ...full, nationality: '' }, 'b1').problem === 'Nationality is required');
  h.check('§2 a date of birth that cannot be read is said, never sent wrong', registerBody({ ...full, date_of_birth: '31 Feb 1995' }, 'b1').problem === 'Date of birth: type it as 14 Nov 1995.');
  h.check('§2 Gender is the website’s two words', /<option>Female<\/option>\s*<option>Male<\/option>/.test(readAmsFile('client/src/pages/students/StudentNew.js')));

  // §3 the country lists — the AMS's one dataset, vendored byte for byte; the phone prefix run beside the AMS's
  const ven = read('../vendor/ams/countries.ts');
  const marker = '// ── verbatim below ──\n';
  const vbody = ven.slice(ven.indexOf(marker) + marker.length);
  const amsCountries = readAmsFile('client/src/utils/countries.js');
  h.check('§3 the vendored countries file is the AMS’s, byte for byte', ven.includes(marker) && vbody === amsCountries, `${vbody.length} vs ${amsCountries.length}`);
  const v = VENDORED as unknown as {
    buildList: (f: string, c: string[]) => string[];
    PRIORITY_NATIONALITY_CODES: string[];
    PRIORITY_COUNTRY_CODES: string[];
    dialForCountryName: (n: string) => string | null;
    DIAL_CODES: Set<string>;
  };
  h.check(
    '§3 nationality and country lists are the website’s (the separator left out on a phone)',
    canon(NATIONALITIES) === canon(v.buildList('demonym', v.PRIORITY_NATIONALITY_CODES).filter((x) => x !== '---')) &&
      canon(COUNTRIES) === canon(v.buildList('name', v.PRIORITY_COUNTRY_CODES).filter((x) => x !== '---')) &&
      NATIONALITIES[0] === 'Kuwaiti' &&
      COUNTRIES[0] === 'Kuwait' &&
      NATIONALITIES.length > 150,
  );
  const pp = strip(readAmsFile('client/src/lib/phonePrefix.js'));
  const ppSrc = [declOf(pp, 'dialPrefix'), declOf(pp, 'isPrefixOnly')];
  h.check('§3 the AMS phone-prefix functions extract', ppSrc.every((s) => s.length > 60), ppSrc.map((s) => s.length).join());
  const amsPP = new Function('dialForCountryName', 'DIAL_CODES', `${ppSrc.join('\n')}; return { dialPrefix, isPrefixOnly };`)(v.dialForCountryName, v.DIAL_CODES) as {
    dialPrefix: (c: string) => string;
    isPrefixOnly: (x: string, p: string) => boolean;
  };
  const countries = ['Kuwait', 'India', 'Philippines', 'UAE', 'Other', '', 'kuwait ', 'Atlantis'];
  h.check('§3 dialPrefix answers as the AMS’s, country by country', countries.every((c) => dialPrefix(c) === amsPP.dialPrefix(c)), countries.map((c) => `${c}:${dialPrefix(c)}|${amsPP.dialPrefix(c)}`).join(' '));
  const boxes: [string, string][] = [['', '+965 '], ['+965 ', '+965 '], ['+965', ''], ['+9655', '+965 '], ['+965 5', '+965 '], ['+91 ', '+965 '], ['5555 1234', '+965 '], ['+1-', '']];
  h.check('§3 isPrefixOnly answers as the AMS’s, box by box', boxes.every(([x, p]) => isPrefixOnly(x, p) === amsPP.isPrefixOnly(x, p)), boxes.map(([x, p]) => `${x}:${isPrefixOnly(x, p)}|${amsPP.isPrefixOnly(x, p)}`).join(' '));

  // §4 the enrolment — the AMS's own code run on the same inputs
  const flow = strip(readAmsFile('client/src/lib/enrollmentFlow.js'));
  const inst = strip(readAmsFile('client/src/lib/installments.js'));
  const dates = strip(readAmsFile('client/src/lib/dates.js'));
  const consts = strip(readAmsFile('client/src/utils/constants.js'));
  const parts: [string, string][] = [
    ['MIN_INSTALLMENTS', declOf(inst, 'MIN_INSTALLMENTS')],
    ['MIN_CHARGE_INSTALLMENTS', declOf(inst, 'MIN_CHARGE_INSTALLMENTS')],
    ['MAX_INSTALLMENTS', declOf(inst, 'MAX_INSTALLMENTS')],
    ['splitNetIntoInstallments', declOf(inst, 'splitNetIntoInstallments')],
    ['validateInstallmentCount', declOf(inst, 'validateInstallmentCount')],
    ['toDateStr', declOf(dates, 'toDateStr')],
    ['isValidDateStr', declOf(dates, 'isValidDateStr')],
    ['DAYS_OF_WEEK', declOf(consts, 'DAYS_OF_WEEK')],
    ['normalizeDays', declOf(consts, 'normalizeDays')],
    ['errMsg', declOf(flow, 'errMsg')],
    ['toPaidNow', declOf(flow, 'toPaidNow')],
    ['validateEnrollment', declOf(flow, 'validateEnrollment')],
    ['validatePayment', declOf(flow, 'validatePayment')],
    ['buildInstallmentItems', declOf(flow, 'buildInstallmentItems')],
    ['runEnrollmentFull', declOf(flow, 'runEnrollmentFull')],
    ['postPayment', declOf(flow, 'postPayment')],
  ];
  const empty = parts.filter(([, s]) => s.length < 20).map(([n]) => n);
  h.check('§4 every AMS function this copies extracts from the AMS (floor)', empty.length === 0 && declOf(flow, 'runEnrollmentFull').length > 2000, empty.join() || 'all');
  type Ams = {
    splitNetIntoInstallments: typeof splitNetIntoInstallments;
    validateInstallmentCount: typeof validateInstallmentCount;
    toDateStr: typeof toDateStr;
    isValidDateStr: typeof isValidDateStr;
    normalizeDays: typeof normalizeDays;
    toPaidNow: typeof toPaidNow;
    validateEnrollment: (a: Record<string, unknown>) => string | null;
    validatePayment: typeof validatePayment;
    buildInstallmentItems: typeof buildInstallmentItems;
    runEnrollmentFull: (i: Record<string, unknown>) => Promise<{ paymentError: string | null; enrollmentError: string | null }>;
    postPayment: (i: Record<string, unknown>) => Promise<unknown>;
  };
  const sent: { enrol?: unknown; pay?: unknown } = {};
  const TODAY = '2026-11-14';
  let ams: Ams;
  try {
    ams = new Function(
      'sent',
      'TODAY',
      `const today = () => TODAY;
       const createEnrollmentFull = async (b) => { sent.enrol = JSON.parse(JSON.stringify(b)); return { enrollment: { id: 'e1', schedule_id: b.schedule_id }, plan: b.plan ? {} : null, transaction: b.payment ? {} : null }; };
       const recordActualPayment = async (p) => { sent.pay = JSON.parse(JSON.stringify(p)); return {}; };
       ${parts.map(([, s]) => s).join('\n')}
       return { splitNetIntoInstallments, validateInstallmentCount, toDateStr, isValidDateStr, normalizeDays, toPaidNow, validateEnrollment, validatePayment, buildInstallmentItems, runEnrollmentFull, postPayment };`,
    )(sent, TODAY) as Ams;
  } catch (err) {
    throw new Error(`the AMS's enrolment code could not be loaded here: ${err instanceof Error ? err.message : String(err)}`);
  }

  const splits: [number | string, number | string][] = [[200, 3], [100, 3], ['350.5', 4], [0, 2], [1, 7], [90, 1], [200, '3'], [200, 0], [200, 'x']];
  h.check('§4 the instalment split is the AMS’s', splits.every(([a, b]) => canon(splitNetIntoInstallments(a, b)) === canon(ams.splitNetIntoInstallments(a, b))), splits.map(([a, b]) => splitNetIntoInstallments(a, b).join('+')).join(' · '));
  const counts: unknown[] = ['', null, undefined, ' ', 'abc', 2.5, 1, 2, 36, 37, '3', 0, -2];
  h.check('§4 the instalment-count refusals are the AMS’s, word for word', counts.every((c) => validateInstallmentCount(c) === ams.validateInstallmentCount(c)), counts.map((c) => String(validateInstallmentCount(c))).join(' | '));
  const dstr: (string | Date | null)[] = ['2026-11-14T21:00:00Z', new Date(2026, 1, 3), null, '', new Date('nope')];
  h.check('§4 toDateStr is the AMS’s', dstr.every((d) => toDateStr(d) === ams.toDateStr(d)));
  const dv: unknown[] = ['2026-02-29', '2028-02-29', '2026-13-01', '2026-1-1', 'x', null, '2026-11-14'];
  h.check('§4 isValidDateStr is the AMS’s', dv.every((d) => isValidDateStr(d) === ams.isValidDateStr(d)));
  const dd: (string[] | string | null)[] = [['Tue', 'Sun'], 'monday, WED,  fri', ['Sunday', 'Sun'], [], null, 'xyz'];
  h.check('§4 class days are normalised as the AMS does', dd.every((d) => normalizeDays(d) === ams.normalizeDays(d)), dd.map((d) => `${normalizeDays(d)}|${ams.normalizeDays(d)}`).join(' · '));
  const pn = ['', '0', '12.5', 'abc', '-3'];
  h.check('§4 "paid now" is read as the AMS reads it', pn.every((x) => toPaidNow({ paid_now: x }) === ams.toPaidNow({ paid_now: x })));
  const items = [
    { netFee: 200, numInstallments: 3, interval: 'monthly' as const },
    { netFee: 100, numInstallments: 4, interval: 'weekly' as const },
    { netFee: 90, numInstallments: 1, interval: 'monthly' as const },
    { netFee: 120, numInstallments: 2, interval: 'monthly' as const, dueDateBase: '2026-01-31' },
  ];
  h.check('§4 the plan’s instalments (amounts and due dates) are the AMS’s', items.every((i) => canon(buildInstallmentItems(i)) === canon(ams.buildInstallmentItems(i))), canon(buildInstallmentItems(items[3])));

  const plan = (o: Partial<PaymentPlan>): PaymentPlan => ({
    payment_type: 'installments',
    installments: '3',
    installment_interval: 'monthly',
    paid_now: '',
    payment_method_id: '',
    method_branch_id: 'b1',
    proof_url: null,
    ...o,
  });
  type V = Parameters<typeof validateEnrollment>[0];
  const vb: V = { courseId: 'c', selectedScheduleId: 'b', hoursPerSession: '', teacherId: null, startDate: TODAY, days: [], payment: plan({}) };
  const vi: V = { ...vb, selectedScheduleId: null, hoursPerSession: '2', teacherId: 't', days: ['Sun'] };
  const vcases: V[] = [
    { ...vi, courseId: '' },
    { ...vi, startDate: '' },
    { ...vi, startDate: '2026-02-30' },
    { ...vi, hoursPerSession: '0' },
    { ...vi, teacherId: null },
    { ...vi, days: [] },
    { ...vb, payment: plan({ payment_type: '' }) },
    { ...vb, payment: plan({ method_branch_id: '' }) },
    { ...vb, payment: plan({ paid_now: '-1' }) },
    { ...vb, payment: plan({ paid_now: '50' }) },
    { ...vb, payment: plan({ installments: '1' }) },
    { ...vb, payment: plan({ payment_type: 'full', installments: '' }) },
    { ...vb, payment: plan({ paid_now: '50', payment_method_id: 'm' }) },
    vi,
  ];
  const amsV = (c: V) => ams.validateEnrollment({ ...c, requireScheduleFields: true, requirePaymentPlan: true });
  const vdiff = vcases.filter((c) => validateEnrollment(c) !== amsV(c)).map((c) => `${validateEnrollment(c)} | ${amsV(c)}`);
  h.check(`§4 validateEnrollment refuses exactly as the AMS does (${vcases.length} cases, the last three valid)`, vdiff.length === 0 && validateEnrollment(vi) === null && validateEnrollment(vcases[11]) === null, vdiff.join(' ;; ') || 'same');
  const pcases: Parameters<typeof validatePayment>[0][] = [
    { amount: '', paymentMethodId: 'm', requiresProof: false, proofUrl: null },
    { amount: '0', paymentMethodId: 'm', requiresProof: false, proofUrl: null },
    { amount: '10', paymentMethodId: '', requiresProof: false, proofUrl: null },
    { amount: '10', paymentMethodId: 'm', requiresProof: true, proofUrl: null },
    { amount: '10', paymentMethodId: 'm', requiresProof: true, proofUrl: '/uploads/payment-proofs/x.jpg' },
  ];
  h.check('§4 validatePayment refuses exactly as the AMS does', pcases.every((c) => validatePayment(c) === ams.validatePayment(c)));

  // The body POST /enrollments/full is sent: runEnrollmentFull's, built by the AMS's own function with its call captured.
  const base: EnrolInput = {
    studentId: 's1',
    courseId: 'c1',
    selectedScheduleId: null,
    branchId: 'b1',
    enrolledDate: TODAY,
    startDate: '2026-11-15',
    deliveryMode: 'face_to_face',
    teacherId: 't1',
    chips: { days: ['Tue', 'Sun'], startTime: '16:30', endTime: '18:30', hoursPerSession: '2' },
    courseFee: '200.000',
    payment: plan({}),
  };
  const ecases: EnrolInput[] = [
    base,
    {
      ...base,
      selectedScheduleId: 'batch1',
      chips: { days: ['Mon'], startTime: '', endTime: '', hoursPerSession: '' },
      payment: plan({ payment_type: 'full', paid_now: '90', payment_method_id: 'm1', proof_url: '/uploads/payment-proofs/p.jpg', reference_no: 'KN123', transaction_date: TODAY }),
    },
    { ...base, payment: plan({ installments: '4', installment_interval: 'weekly', paid_now: '50' }) },
    { ...base, payment: plan({ paid_now: '50', payment_method_id: 'm1' }) },
    { ...base, courseFee: null },
    { ...base, deliveryMode: 'hybrid', startDate: null, teacherId: null, chips: { days: [], startTime: '', endTime: '', hoursPerSession: '1.5' } },
  ];
  let same = 0;
  const diffs: string[] = [];
  for (const c of ecases) {
    sent.enrol = undefined;
    const r = await ams.runEnrollmentFull({ ...c });
    const mine = enrolBody(c);
    const mineJson = JSON.parse(JSON.stringify(mine.body)) as unknown;
    if (sent.enrol !== undefined && canon(sent.enrol) === canon(mineJson) && (r.paymentError ?? null) === mine.paymentError && !r.enrollmentError) same++;
    else diffs.push(`${canon(sent.enrol)}\n    vs ${canon(mineJson)}\n    ${r.paymentError} vs ${mine.paymentError} · ${r.enrollmentError}`);
  }
  h.check(`§4 the /enrollments/full body is exactly the AMS’s own (${ecases.length} enrolments: batch, individual, plans, paid now, no method, no fee)`, same === ecases.length, diffs.join('\n  '));
  h.check('§4 …a batch never carries the student’s own days (the batch rule)', (enrolBody(ecases[1]).body.class_days ?? null) === null && enrolBody(ecases[0]).body.class_days === 'Sun, Tue');
  const noMethod = enrolBody(ecases[2]).body as { plan: { upfront_amount: number }; payment?: unknown };
  h.check('§4 …and the plan claims an upfront only with its payment (EN-011022)', noMethod.plan.upfront_amount === 0 && !('payment' in noMethod) && !!enrolBody(ecases[2]).paymentError);
  const p0 = (enrolBody(base).body as { plan: Record<string, unknown> }).plan;
  h.check('§4 …no discount and no coupon from the app (they stay on the website)', p0.discount === 0 && p0.coupon_code === undefined);

  // §5 Take a payment — postPayment's payload, built by the AMS's own function
  const paycases: Parameters<typeof paymentBody>[0][] = [
    { studentId: 's1', enrollmentId: 'e1', amount: '90', paymentMethodId: 'm1', proofUrl: null },
    { studentId: 's1', enrollmentId: 'e1', amount: '12.5', paymentMethodId: 'm2', proofUrl: '/uploads/payment-proofs/a.jpg', referenceNo: 'KN-77', transactionDate: TODAY },
    { studentId: 's1', enrollmentId: 'e1', amount: '5', paymentMethodId: 'm2', proofUrl: null, referenceNo: '', transactionDate: '' },
  ];
  let paySame = 0;
  for (const c of paycases) {
    sent.pay = undefined;
    await ams.postPayment({ ...c });
    if (sent.pay !== undefined && canon(sent.pay) === canon(paymentBody(c))) paySame++;
  }
  h.check('§5 the /payments body is exactly the AMS’s own postPayment payload', paySame === paycases.length, `${canon(sent.pay)} vs ${canon(paymentBody(paycases[2]))}`);
  const pc = strip(readAmsFile('server/src/controllers/paymentsController.js'));
  const recordPayment = declOf(pc, 'recordPayment');
  const payReads = /const \{([^}]*)\} = req\.body;/.exec(recordPayment)?.[1].split(',').map((x) => x.trim()) ?? [];
  h.check('§5 recordPayment reads every field the app sends', payReads.length >= 8 && Object.keys(paymentBody(paycases[1])).every((k) => payReads.includes(k)), payReads.join());

  // §6 one press, one write — the screens send the press's key on every money write
  const screens = { RegisterScreen: 'register', EnrolScreen: 'enrol', TakePaymentScreen: 'pay' } as const;
  for (const [file, key] of Object.entries(screens)) {
    const src = strip(read(`./${file}.tsx`));
    h.check(`§6 ${file} reads, and is not a stub`, src.length > 4000, String(src.length));
    h.check(
      `§6 ${file} sends MONEY_API.${key} with the press's key`,
      new RegExp(`ams\\.request(?:<[^>]*>)?\\('POST', MONEY_API\\.${key}\\.path, body, \\{ idempotencyKey: press\\.current\\.current\\(\\) \\}\\)`).test(src),
    );
    h.check(`§6 ${file} settles the key on every answer, and a changed form starts a new press`, /settlePress\(press\.current, r\)/.test(src) && /press\.current\.reset\(\)/.test(src));
  }
  const fail = (o: Record<string, unknown>) => ({ ok: false as const, failure: { kind: 'refused' as const, message: 'm', ...o } });
  const pk = new PressKey();
  const k1 = pk.current();
  const off = settlePress(pk, fail({ kind: 'offline' }));
  const kept = pk.held === k1;
  const inprog = settlePress(pk, fail({ status: 409, code: 'IN_PROGRESS' }));
  h.check('§6 no answer: the same key is kept, so pressing again cannot save twice', !off.ok && kept && /never saved twice/.test(off.ok ? '' : off.message));
  h.check('§6 409 IN_PROGRESS: "check the record", in the AMS’s words, and no key kept', !inprog.ok && inprog.checkRecord && inprog.message === IN_PROGRESS_WORDS && pk.held === null);
  pk.current();
  const refused = settlePress(pk, fail({ status: 400, message: 'Phone is required' }));
  h.check('§6 a refusal is final for its key (fix it: a new press), in the AMS’s words', !refused.ok && refused.message === 'Phone is required' && pk.held === null);
  pk.current();
  h.check('§6 a success throws the key away', settlePress(pk, { ok: true, value: 1 }).ok && pk.held === null);
  h.check('§6 the 409 words are the AMS’s own', readAmsFile('server/src/middleware/idempotency.js').includes(IN_PROGRESS_WORDS));

  // §7 the receipt PDF
  const rc = readAmsFile('server/src/controllers/enrollmentMailController.js') + readAmsFile('server/src/controllers/enrollmentsController.js');
  h.check('§7 the AMS names the PDF "ICSA receipt <EN> <date>"', /ICSA receipt /.test(rc));
  h.check('§7 the phone saves it under the same name', receiptFileName('EN-021001', TODAY) === 'ICSA receipt EN-021001 14 Nov 2026.pdf' && receiptFileName(null, TODAY) === 'ICSA receipt enrolment 14 Nov 2026.pdf');
  const rb = strip(read('./ReceiptButton.tsx'));
  h.check(
    '§7 it is downloaded with the sign-in and handed to the share sheet as a PDF',
    /File\.downloadFileAsync\(AMS_API_URL \+ pathFor\(MONEY_API\.receiptPdf\.path, \{ id: enrollmentId \}\)/.test(rb) && /Authorization: `Bearer \$\{tok\.value\}`/.test(rb) && /Sharing\.shareAsync\(file\.uri, \{ mimeType: 'application\/pdf'/.test(rb),
  );

  // §8 the fee summary as the AMS sends it (items under schedules; due dates as UTC instants)
  const sum: Summary = {
    balance_overall: '90.000',
    enrollments: [
      {
        enrollment_id: 'e1',
        enrollment_no: 'EN-021042',
        course_name: 'Computer Secretarial',
        status: 'active',
        net_amount: '350.000',
        total_paid: '260.000',
        balance: '90.000',
        schedules: [
          {
            items: [
              { id: 'i3', installment_no: 3, due_date: '2026-11-09T21:00:00.000Z', scheduled_amount: '140.000', paid_amount: '50.000', status: 'partial' },
              { id: 'i1', installment_no: 1, due_date: '2026-09-09T21:00:00.000Z', scheduled_amount: '110.000', paid_amount: '110.000', status: 'paid' },
            ],
          },
        ],
      },
      { enrollment_id: 'e2', enrollment_no: 'EN-021043', course_name: 'IELTS', status: 'active', net_amount: '200.000', total_paid: '200.000', balance: '0.000', schedules: [] },
    ],
  };
  h.check('§8 only enrolments that owe are offered', owing(sum).length === 1 && owing(sum)[0].enrollment_id === 'e1' && owing(null).length === 0);
  const nx = nextInstalment(owing(sum)[0]);
  h.check('§8 the next instalment is the first not paid, what is left of it', nx?.no === 3 && nx.left === '90.000');
  const amsSummary = declOf(pc, 'getStudentPaymentSummary');
  h.check(
    '§8 the summary sends items under each schedule, and the fields read here',
    /items: itemsBySch\[sch\.id\] \|\| \[\]/.test(amsSummary) && ['enrollment_id', 'enrollment_no', 'course_name', 'balance:', 'total_paid:', 'net_amount:', 'schedules,'].every((f) => amsSummary.includes(f)),
  );

  // §9 dates and times as typed (Yasir's "14 Nov 2026"), never a locale format
  const typed: [string, string | null][] = [
    ['14 Nov 1995', '1995-11-14'],
    ['14 november 1995', '1995-11-14'],
    ['1 Sep 2000', '2000-09-01'],
    ['14/11/1995', '1995-11-14'],
    ['31 Feb 1995', null],
    ['1995-11-14', null],
    ['Nov 14 1995', null],
    ['', null],
  ];
  h.check('§9 a typed date is read only in the house shape (or day/month/year)', typed.every(([x, y]) => parseHouseDate(x) === y), typed.map(([x]) => `${x}→${parseHouseDate(x)}`).join(' '));
  h.check('§9 a date is shown "14 Nov 2026" — no leading zero, never "Sept"', houseDay('2026-11-04') === '4 Nov 2026' && houseDay('2026-09-14') === '14 Sep 2026' && houseDay(null) === '');
  const clocks: [string, string | null][] = [['4:30 PM', '16:30'], ['4 pm', '16:00'], ['12:00 am', '00:00'], ['12:15 PM', '12:15'], ['16:30', '16:30'], ['16', null], ['25:00', null], ['13 pm', null], ['4:75 pm', null]];
  h.check('§9 a class time is read as the AMS stores it', clocks.every(([x, y]) => parseClock(x) === y), clocks.map(([x]) => `${x}→${parseClock(x)}`).join(' '));

  // §10 wiring, and Yasir's 14 Nov 2026 ruling: no Civil ID scan in the app
  const today = strip(read('./TodayScreen.tsx'));
  h.check(
    '§10 Today’s tiles open Register, Take payment and Enrol',
    /'Register student'[^\n]*router\.push\('\/register'\)/.test(today) && /'Take payment'[^\n]*router\.push\('\/take-payment'\)/.test(today) && /'Enrol in a course'[^\n]*router\.push\('\/enrol'\)/.test(today),
  );
  h.check('§10 the three screens have routes', ['register', 'enrol', 'take-payment'].every((r) => existsSync(new URL(`../app/${r}.tsx`, import.meta.url))));
  h.check('§10 Reception › New is built (no placeholder)', /name: 'new',[^\n]*phase: 3, built: true/.test(read('../navigation/tabs.ts')) && !/TabPlaceholder/.test(read('../app/reception/new.tsx')));
  const appSrc = ['./RegisterScreen.tsx', './money.ts', './ui.tsx', './NewScreen.tsx'].map((f) => strip(read(f))).join('\n');
  h.check('§10 no Civil ID scan: nothing calls /id-extract (Yasir, 14 Nov 2026)', appSrc.length > 10000 && !/id-extract/.test(appSrc));
  h.check('§10 the AMS copy the checks read is beside this repo', existsSync(resolve(amsDir(), 'client/src/lib/enrollmentFlow.js')));
});
