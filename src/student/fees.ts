// The student's Fees (Phase 2, mockup 04, approved 3 Nov 2026; built 7 Nov
// 2026). Pure, so fees.check.ts holds it to the AMS's studentPortal getMyFees
// and paymentProofsController.
//
// Every figure is the AMS's: the fee, paid and balance per enrolment come
// from GET /auth/student/fees as the AMS computes them — never added up here.
// A payment proof is a REQUEST: reception confirms it and only then is money
// recorded. It needs a live connection and is sent once per tap (no retry).

export const FEES_API = {
  fees: { method: 'GET', path: '/auth/student/fees' },
  proofs: { method: 'GET', path: '/payment-proofs/mine' },
  submit: { method: 'POST', path: '/payment-proofs' },
} as const;

export type Instalment = {
  id: string;
  installment_no: number;
  due_date: string;
  scheduled_amount: number | string;
  paid_amount: number | string;
  status: 'pending' | 'partial' | 'paid' | string;
};

export type FeeEnrolment = {
  id: string;
  enrollment_no: string | null;
  status: string;
  course_name: string | null;
  net_amount: number | string | null;
  paid: string;
  balance: string;
  items: Instalment[];
};

export type Proof = {
  id: string;
  amount: number | string;
  status: 'pending' | 'approved' | 'rejected' | string;
  submitted_at: string;
  course_name: string | null;
  note: string | null;
  review_note?: string | null;
};

/** The multipart field names the AMS reads (upload.single('proof') and req.body). */
export const PROOF_FIELDS = { file: 'proof', amount: 'amount', paidDate: 'paid_date', note: 'note', enrollment: 'enrollment_id' } as const;

/** The image types the AMS accepts for a proof (uploadsController fileFilter, PDF aside). */
export const PROOF_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** What a proof form sends, or why it cannot be sent yet. */
export function proofFields(args: {
  amount: string;
  enrollmentId: string | null;
  paidDate: string; // YYYY-MM-DD, Kuwait
  note: string;
  hasPhoto: boolean;
}): { ok: true; fields: Record<string, string> } | { ok: false; message: string } {
  if (!args.hasPhoto) return { ok: false, message: 'Add a photo or screenshot of the payment.' };
  const amt = Number(args.amount.trim());
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, message: 'Enter the amount you paid, in KD.' };
  const fields: Record<string, string> = { [PROOF_FIELDS.amount]: String(amt), [PROOF_FIELDS.paidDate]: args.paidDate };
  if (args.enrollmentId) fields[PROOF_FIELDS.enrollment] = args.enrollmentId;
  if (args.note.trim()) fields[PROOF_FIELDS.note] = args.note.trim();
  return { ok: true, fields };
}

/** What a proof's status says. */
export function proofWord(p: Pick<Proof, 'status'>): { tone: 'warning' | 'success' | 'danger'; text: string } {
  if (p.status === 'approved') return { tone: 'success', text: 'Confirmed by reception' };
  if (p.status === 'rejected') return { tone: 'danger', text: 'Not accepted' };
  return { tone: 'warning', text: 'Waiting for reception' };
}

/** One instalment's line, by its AMS status and due date against today (Kuwait). */
export function instalmentLine(
  it: Instalment,
  today: string,
  day: (v: string) => string,
  kuwaitDay: (v: string) => string | null,
  kd: (v: number | string) => string,
): { state: 'paid' | 'partial' | 'overdue' | 'due'; text: string } {
  if (it.status === 'paid') return { state: 'paid', text: 'Paid' };
  if (it.status === 'partial') return { state: 'partial', text: `Part paid: ${kd(it.paid_amount)} of ${kd(it.scheduled_amount)} · due ${day(it.due_date)}` };
  const d = kuwaitDay(it.due_date);
  if (d && d < today) return { state: 'overdue', text: `Overdue since ${day(it.due_date)}` };
  return { state: 'due', text: `Due ${day(it.due_date)}` };
}

/** The next amount to suggest on the proof form: the first instalment not paid, what is left of it. */
export function suggestedAmount(e: FeeEnrolment | null | undefined): string {
  const it = (e?.items ?? []).find((x) => x.status !== 'paid');
  if (!it) return '';
  const left = Number(it.scheduled_amount) - Number(it.paid_amount || 0);
  return left > 0 ? left.toFixed(3) : '';
}

/** The paid share for the bar — display only; the figures shown are the AMS's. */
export function paidShare(e: Pick<FeeEnrolment, 'net_amount' | 'paid'>): number {
  const net = Number(e.net_amount) || 0;
  const paid = Number(e.paid) || 0;
  return net > 0 ? Math.max(0, Math.min(1, paid / net)) : 0;
}

// ── The photo: shrunk as the website shrinks it (utils/imageCompress.js) ────
//
// The AMS takes a proof of at most 500 KB (uploadsController MAX_BYTES). A
// phone photo is several MB, so it is resized to fit 1600 px and saved as
// JPEG at 0.85, with a second pass at 0.7 if it is still too big.

export const PROOF_MAX_DIM = 1600;
export const PROOF_QUALITY = 0.85;
export const PROOF_SECOND_QUALITY = 0.7;
export const PROOF_MAX_BYTES = 500 * 1024;

/** The size that fits within max × max, keeping the shape (never enlarged). */
export function fitWithin(width: number, height: number, max = PROOF_MAX_DIM): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  return width >= height
    ? { width: max, height: Math.round(height * (max / width)) }
    : { width: Math.round(width * (max / height)), height: max };
}
