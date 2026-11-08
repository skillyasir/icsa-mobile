import { readFileSync } from 'node:fs';

import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import { formatDay, kd, kuwaitDay } from '../attendance/rules.ts';
import {
  FEES_API,
  PROOF_FIELDS,
  PROOF_IMAGE_TYPES,
  PROOF_MAX_BYTES,
  PROOF_MAX_DIM,
  PROOF_QUALITY,
  PROOF_SECOND_QUALITY,
  fitWithin,
  instalmentLine,
  paidShare,
  proofFields,
  proofWord,
  suggestedAmount,
  type Instalment,
} from './fees.ts';

// The student's Fees and payment proof (7 Nov 2026) against the AMS: the
// endpoints are routed and in the student firewall, the figures come from
// getMyFees as computed there, the proof form sends the fields the AMS reads,
// and the photo is shrunk exactly as the website shrinks it.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const body = (src: string, name: string) => new RegExp(`const ${name} = async[\\s\\S]*?\\n};`).exec(src)?.[0] ?? '';

run('fees.check — the student Fees agree with the AMS', (h) => {
  h.check('§0 body() finds a function and stops at its end', body('const a = async (x) => {\n  y;\n};\nconst b = 1;', 'a') === 'const a = async (x) => {\n  y;\n};');

  // §1 routed, and open to a student
  const fw = strip(readAmsFile('server/src/middleware/studentFirewall.js'));
  const authR = strip(readAmsFile('server/src/routes/auth.js'));
  const proofR = strip(readAmsFile('server/src/routes/paymentProofs.js'));
  h.check('§1 the AMS files were read', fw.length > 1500 && authR.length > 1000 && proofR.length > 300);
  const eps = Object.values(FEES_API);
  h.check('§1 three endpoints (floor)', eps.length === 3);
  for (const e of eps) {
    h.check(`§1 ${e.method} /api${e.path} is in the student firewall`, new RegExp(`method: '${e.method}',\\s*path: '/api${e.path.replace(/\//g, '\\/')}'`).test(fw));
  }
  h.check('§1 the fees route', /router\.get\('\/student\/fees', auth, studentPortal\.getMyFees\);/.test(authR));
  h.check('§1 the proof routes: upload.single(\'proof\'), and mine', /router\.post\('\/', auth, upload\.single\('proof'\), c\.submitProof/.test(proofR) && /router\.get\('\/mine', auth, c\.getMyProofs\);/.test(proofR));

  // §2 the figures are the AMS's
  const portal = strip(readAmsFile('server/src/controllers/studentPortalController.js'));
  const fees = body(portal, 'getMyFees');
  h.check('§2 getMyFees extracts (floor)', fees.length > 1200, String(fees.length));
  h.check('§2 the AMS computes paid and balance per enrolment', /paid: p\.toFixed\(3\),/.test(fees) && /balance: \(net - p\)\.toFixed\(3\),/.test(fees));
  h.check('§2 …and sends each instalment\'s status and amounts', /ii\.scheduled_amount, ii\.paid_amount, ii\.status/.test(fees));
  h.check('§2 the bar is a share of the AMS\'s figures, never a sum', paidShare({ net_amount: '350.000', paid: '260.000' }) > 0.74 && paidShare({ net_amount: 0, paid: '5' }) === 0 && paidShare({ net_amount: 10, paid: '20' }) === 1);

  // §3 the proof form sends what the AMS reads
  const ctl = strip(readAmsFile('server/src/controllers/paymentProofsController.js'));
  const submit = body(ctl, 'submitProof');
  h.check('§3 submitProof extracts (floor)', submit.length > 1500, String(submit.length));
  h.check('§3 the AMS reads amount, paid_date, note, enrollment_id', /const \{ amount, paid_date, note, enrollment_id \} = req\.body;/.test(submit));
  h.check('§3 …and the file as "proof"', PROOF_FIELDS.file === 'proof');
  const good = proofFields({ amount: '90', enrollmentId: 'e1', paidDate: '2026-11-07', note: ' KNET ', hasPhoto: true });
  h.check('§3 a complete form sends those fields', good.ok && Object.keys(good.fields).sort().join() === 'amount,enrollment_id,note,paid_date' && good.fields.note === 'KNET');
  const send = good.ok ? Object.keys(good.fields) : [];
  h.check('§3 every field sent is one the AMS reads', send.every((k) => ['amount', 'paid_date', 'note', 'enrollment_id'].includes(k)));
  h.check('§3 the AMS refuses no amount; the form says so first', /if \(!amt \|\| amt <= 0\)/.test(submit) && !proofFields({ amount: '0', enrollmentId: null, paidDate: '2026-11-07', note: '', hasPhoto: true }).ok);
  h.check('§3 no photo, nothing sent', !proofFields({ amount: '90', enrollmentId: null, paidDate: '2026-11-07', note: '', hasPhoto: false }).ok);
  h.check('§3 no note is not sent', proofFields({ amount: '1', enrollmentId: null, paidDate: '2026-11-07', note: '  ', hasPhoto: true }).ok && !('note' in (proofFields({ amount: '1', enrollmentId: null, paidDate: '2026-11-07', note: '', hasPhoto: true }) as { fields: object }).fields));

  // §4 the photo: types and size the AMS takes, shrunk as the website does
  const up = strip(readAmsFile('server/src/controllers/uploadsController.js'));
  const maxBytes = /const MAX_BYTES = (\d+) \* 1024;/.exec(up)?.[1];
  h.check('§4 the AMS takes up to 500 KB', Number(maxBytes) * 1024 === PROOF_MAX_BYTES, String(maxBytes));
  const types = /\/\^image\\\/\(([a-z|]+)\)\$\/i/.exec(up)?.[1]?.split('|') ?? [];
  h.check('§4 every image type the app sends is one the AMS takes', PROOF_IMAGE_TYPES.every((t) => types.includes(t.replace('image/', ''))), types.join());
  const web = strip(readAmsFile('client/src/utils/imageCompress.js'));
  h.check('§4 the website shrinks to 1600 px at 0.85', /const MAX_DIM = (\d+);/.exec(web)?.[1] === String(PROOF_MAX_DIM) && /const QUALITY = ([\d.]+);/.exec(web)?.[1] === String(PROOF_QUALITY));
  h.check('§4 …with a second pass at 0.7, for 500 KB', /0\.7/.test(web) && /const TARGET_BYTES = 500 \* 1024;/.test(web) && PROOF_SECOND_QUALITY === 0.7);
  h.check('§4 a 4032 × 3024 photo fits 1600 × 1200', JSON.stringify(fitWithin(4032, 3024)) === '{"width":1600,"height":1200}');
  h.check('§4 a portrait one fits 1200 × 1600', JSON.stringify(fitWithin(3024, 4032)) === '{"width":1200,"height":1600}');
  h.check('§4 a small one is never enlarged', JSON.stringify(fitWithin(800, 600)) === '{"width":800,"height":600}');

  // §5 the instalment lines and proof words
  const it = (over: Partial<Instalment>): Instalment => ({ id: 'i', installment_no: 1, due_date: '2026-11-10', scheduled_amount: '90.000', paid_amount: '0', status: 'pending', ...over });
  const line = (x: Instalment) => instalmentLine(x, '2026-11-07', formatDay, kuwaitDay, kd);
  h.check('§5 paid', line(it({ status: 'paid' })).state === 'paid');
  h.check('§5 due ahead', line(it({})).text === 'Due 10 Nov 2026', line(it({})).text);
  h.check('§5 a DATE as Kuwait midnight in UTC reads as its day', line(it({ due_date: '2026-11-09T21:00:00.000Z' })).text === 'Due 10 Nov 2026');
  h.check('§5 overdue', line(it({ due_date: '2026-10-20' })).state === 'overdue' && line(it({ due_date: '2026-10-20' })).text === 'Overdue since 20 Oct 2026');
  h.check('§5 due today is not overdue yet', line(it({ due_date: '2026-11-07' })).state === 'due');
  h.check('§5 part paid names both amounts', line(it({ status: 'partial', paid_amount: '30' })).text === 'Part paid: 30.000 of 90.000 · due 10 Nov 2026');
  // Yasir, 8 Nov 2026: part paid and past its date is overdue (Graphics, 5.000 of 200.000, due 15 Sep 2026).
  const latePart = line(it({ status: 'partial', paid_amount: '5', scheduled_amount: '200', due_date: '2026-09-15' }));
  h.check('§5 part paid and past its date is overdue, in red', latePart.state === 'overdue', latePart.state);
  h.check('§5 …and still names both amounts', latePart.text === 'Part paid: 5.000 of 200.000 · overdue since 15 Sep 2026', latePart.text);
  h.check('§5 part paid and due today is not overdue yet', line(it({ status: 'partial', paid_amount: '30', due_date: '2026-11-07' })).state === 'partial');
  h.check('§5 part paid, a DATE as Kuwait midnight in UTC: 7 Nov on 7 Nov is not overdue yet', line(it({ status: 'partial', paid_amount: '30', due_date: '2026-11-06T21:00:00.000Z' })).state === 'partial');
  h.check('§5 the AMS\'s three proof statuses have words', ['pending', 'approved', 'rejected'].every((s) => proofWord({ status: s }).text.length > 5) && /status='rejected'/.test(ctl) && /'pending'/.test(submit));
  h.check('§5 the suggested amount is what is left of the first unpaid instalment',
    suggestedAmount({ id: 'e', enrollment_no: null, status: 'active', course_name: null, net_amount: 350, paid: '260', balance: '90',
      items: [it({ status: 'paid' }), it({ status: 'partial', scheduled_amount: '140', paid_amount: '50' })] }) === '90.000');
  h.check('§5 nothing unpaid, nothing suggested', suggestedAmount(null) === '');

  // §6 how the proof is SENT (8 Nov 2026). This Expo replaces the global fetch
  // with Expo's, which refuses React Native's { uri, name, type } file part:
  // the first upload threw on the phone before anything was sent, and was
  // shown as "Cannot reach ICSA". The screen sends with expo-file-system's
  // multipart upload instead. Asserted on USES (a call, an option), never on
  // a mention, and the extraction is floored first.
  const screen = strip(readFileSync(new URL('./ProofScreen.tsx', import.meta.url), 'utf8'));
  h.check('§6 the proof screen reads, and is not a stub', screen.length > 3000, String(screen.length));
  h.check('§6 no FormData is built (Expo\'s fetch refuses a { uri } file part)', !/new\s+FormData\s*\(/.test(screen));
  h.check('§6 no fetch( call sends it', !/\bfetch\s*\(/.test(screen));
  const call = /\.upload\(\s*AMS_API_URL\s*\+\s*FEES_API\.submit\.path\s*,\s*\{([\s\S]*?)\}\s*\)/.exec(screen)?.[1] ?? '';
  h.check('§6 it is sent by File.upload to the submit path', call.length > 0);
  h.check('§6 …as multipart', /uploadType:\s*UploadType\.MULTIPART\b/.test(call));
  h.check('§6 …with the file in the field the AMS reads', /fieldName:\s*PROOF_FIELDS\.file\b/.test(call) && /upload\.single\('proof'\)/.test(proofR) && PROOF_FIELDS.file === 'proof');
  h.check('§6 …as a JPEG, a type the AMS takes', /mimeType:\s*'image\/jpeg'/.test(call) && PROOF_IMAGE_TYPES.includes('image/jpeg'));
  h.check('§6 …with the form fields', /parameters:\s*f\.fields\b/.test(call));
  h.check('§6 …in the foreground, so its answer is known (never left to finish later)', /sessionType:\s*'foreground'/.test(call));
  h.check('§6 …with the sign-in and a time limit', /Authorization:\s*`Bearer \$\{tok\.value\}`/.test(call) && /signal:\s*ac\.signal\b/.test(call));
});
