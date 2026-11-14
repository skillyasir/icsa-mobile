// Managers, bunch 1 (14 Nov 2026): Approvals — mockup 15, approved 3 Nov 2026.
// Pure — no React Native — so approvals.check.ts holds it to the AMS's own
// routes and controllers.
//
// The server decides. Approving a refund moves no money (that happens at its
// completion, with the proof); a discount is applied by the AMS in one locked
// transaction; a certificate is issued exactly as its request holds it (the
// title, printed line and photo are reviewed and stored on the request on the
// website first), under the AMS's fail-closed issuance hold. Every figure is
// the AMS's. A second press after the first went through is said as done.

export const APPROVALS_API = {
  summary: { method: 'GET', path: '/dashboard/approvals' },
  refunds: { method: 'GET', path: '/refunds' },
  approveRefund: { method: 'POST', path: '/refunds/:id/approve' },
  rejectRefund: { method: 'POST', path: '/refunds/:id/reject' },
  discounts: { method: 'GET', path: '/payments/discount-requests' },
  approveDiscount: { method: 'POST', path: '/payments/discount-requests/:id/approve' },
  rejectDiscount: { method: 'POST', path: '/payments/discount-requests/:id/reject' },
  certificates: { method: 'GET', path: '/certificates/requests' },
  approveCertificate: { method: 'POST', path: '/certificates/requests/:id/approve' },
  declineCertificate: { method: 'POST', path: '/certificates/requests/:id/decline' },
} as const;

/** The lists, pending only. */
export const REFUNDS_PENDING = `${APPROVALS_API.refunds.path}?status=initiated`;
export const DISCOUNTS_PENDING = `${APPROVALS_API.discounts.path}?status=pending`;
export const CERTIFICATES_PENDING = `${APPROVALS_API.certificates.path}?status=pending`;

export type Kind = 'refund' | 'discount' | 'certificate';
export type Filter = 'all' | Kind;

export type Refund = {
  id: string;
  amount: string | number;
  reason: string | null;
  student_name: string | null;
  course_name: string | null;
  initiated_by_name: string | null;
  initiated_at: string;
  charge_description: string | null;
  sale_item_name: string | null;
};
export type Discount = {
  id: string;
  student_name: string | null;
  student_code: string | null;
  course_name: string | null;
  requested_by_name: string | null;
  created_at: string;
  gross_amount: string | number | null;
  current_net: string | number | null;
  old_discount: string | number;
  new_discount: string | number;
  reason: string | null;
};
export type CertificateRequest = {
  id: string;
  type: string;
  stage: string;
  student_name: string | null;
  course_name: string | null;
  subject_name: string | null;
  requested_by_name: string | null;
  requested_at: string;
  note: string | null;
};

/** A certificate a manager may issue now: forwarded to him (the AMS's stage `with_manager`). */
export function readyToIssue(c: Pick<CertificateRequest, 'stage'>): boolean {
  return c.stage === 'with_manager';
}

/** Why one is not his yet, in the AMS's own words (approveCertificateRequest). */
export function notYetWords(c: Pick<CertificateRequest, 'stage'>): string {
  return c.stage === 'returned'
    ? 'Sent back for review. It can be approved once it is resubmitted and forwarded.'
    : 'Still with the Academic Supervisor. It can be approved once he forwards it.';
}

/**
 * Is this refusal the AMS saying the request was ALREADY decided (by this
 * press arriving twice, or by another manager first)? Then it is done, not an
 * error — reload and show it gone.
 */
export function alreadyDecided(kind: Kind, message: string): boolean {
  if (kind === 'refund') return /^Cannot (approve|reject): refund is in status '/.test(message);
  if (kind === 'discount') return /^Request is not pending \(status: /.test(message);
  return /^This request has already been (approved|declined)\.$/.test(message);
}

/** The reason each decline needs, and the body field the AMS reads it from. */
export const DECLINE_FIELD: Record<Kind, string> = { refund: 'rejection_reason', discount: 'note', certificate: 'reason' };

/** The body of a decline: the reason, trimmed; none is never sent (the AMS refuses it). */
export function declineBody(kind: Kind, reason: string): { ok: true; body: Record<string, string> } | { ok: false; message: string } {
  const r = reason.trim();
  if (!r) return { ok: false, message: 'Write the reason — the AMS keeps it with the request.' };
  return { ok: true, body: { [DECLINE_FIELD[kind]]: r } };
}

/** The chips over the list (mockup 15): every count is the number of cards the AMS sent. */
export function filterChips(n: { refund: number; discount: number; certificate: number }): { value: Filter; label: string }[] {
  return [
    { value: 'all', label: `All ${n.refund + n.discount + n.certificate}` },
    { value: 'refund', label: `Refunds ${n.refund}` },
    { value: 'discount', label: `Discounts ${n.discount}` },
    { value: 'certificate', label: `Certificates ${n.certificate}` },
  ];
}

export const CERT_TYPE_WORD: Record<string, string> = { course: 'Course certificate', typing: 'Typing certificate' };
