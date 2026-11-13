// One press, one write (AMS S5, live 13 Nov 2026, commit cf6f4fa1).
//
// Every money and creation write the app makes — register, enrol, a plan, a
// payment, a charge, a refund, a payment proof — carries an Idempotency-Key.
// The AMS runs a key once; a retry with the same key gets the first answer
// back (Idempotency-Replayed: true) and nothing runs twice. So a phone on a
// weak signal can retry without recording a payment twice (the app's rule:
// money never queues offline, and never runs twice).
//
// The rules (docs/07-ams-s5-s10-built.md), held by idempotency.check.ts:
//   - a NEW key for each PRESS of the button;
//   - every retry of that press re-sends the SAME key with the SAME body;
//   - the key is thrown away once the press has a final answer — any 2xx or
//     4xx (a refusal is an answer: fix the input, and it is a new press);
//   - no answer, a 5xx or 503 IDEMPOTENCY_UNAVAILABLE: nothing was kept, so
//     the same key may be sent again;
//   - 409 IN_PROGRESS: still running, or saved and the server died. Never
//     retried by the app and never given a new key by itself — a person checks
//     the student's record first (Yasir, 13 Nov 2026).

import type { Failure } from './session';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** The eight AMS routes that take a key (POST); on any other route the AMS ignores it. */
export const IDEMPOTENT_ROUTES = [
  '/students',
  '/students/:studentId/charges',
  '/enrollments',
  '/enrollments/full',
  '/payments/schedule',
  '/payments',
  '/refunds',
  '/payment-proofs',
] as const;

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** 16 random bytes: the platform's secure source when it has one. */
function randomBytes(): number[] {
  const out = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(out);
  else for (let i = 0; i < 16; i++) out[i] = Math.floor(Math.random() * 256);
  return Array.from(out);
}

/** A version 4 UUID — the only kind the AMS accepts. */
export function newIdempotencyKey(): string {
  const b = randomBytes();
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = b.map(hex).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * May this press be sent again with the SAME key? Only when nothing was kept:
 * no answer at all, a server fault, or the AMS could not check the key.
 * Every other answer is final for this key.
 */
export function sameKeyMayRetry(f: Failure): boolean {
  if (f.code === 'IN_PROGRESS') return false;
  if (f.kind === 'offline') return true;
  if (f.code === 'IDEMPOTENCY_UNAVAILABLE') return true;
  return (f.status ?? 0) >= 500;
}

/** 409 IN_PROGRESS: the person must check the student's record before pressing again. */
export function mayAlreadyBeSaved(f: Failure): boolean {
  return f.code === 'IN_PROGRESS';
}

/**
 * One button's key, across retries of the same press. `current()` makes one
 * when there is none; `settle(f)` keeps it only when the same press may be
 * retried; `reset()` throws it away (the form changed, or the press is done).
 */
export class PressKey {
  private key: string | null = null;
  current(): string {
    if (!this.key) this.key = newIdempotencyKey();
    return this.key;
  }
  /** After an answer: success → gone; a failure → kept only if the same press may be retried. */
  settle(failure: Failure | null): void {
    if (!failure || !sameKeyMayRetry(failure)) this.key = null;
  }
  reset(): void {
    this.key = null;
  }
  get held(): string | null {
    return this.key;
  }
}
