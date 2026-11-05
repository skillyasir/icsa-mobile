// The Face ID / fingerprint lock — when it locks, and what it is called.
// Pure TypeScript, so lockRule.check.ts can pin it. Yasir, 5 Nov 2026:
//
//   - it locks after FIVE MINUTES away (a quick reply to a message does not);
//   - it is ON for everyone whose phone can do it, and each person can switch
//     it off in Me;
//   - if Face ID or the fingerprint fails, the phone's own passcode; whoever
//     still cannot unlock signs in again with their ICSA password.
//
// A phone with a passcode but no Face ID / fingerprint is locked with the
// passcode. A phone with neither cannot be locked, and the switch says why.
// The developer preview is never locked: there is no account behind it.

export const LOCK_AFTER_MS = 5 * 60_000;

/** expo-local-authentication's numbers, copied so this file needs no native module. */
export const AUTH_TYPE = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 } as const;
export const SECURITY_LEVEL = { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 } as const;

export type LockAbility = {
  /** Something can unlock it: Face ID, a fingerprint, or at least a passcode. */
  available: boolean;
  /** What the person calls it, for labels: "Face ID", "Touch ID", "fingerprint"… */
  method: string;
};

export function lockAbility(platform: 'ios' | 'android', types: readonly number[], level: number): LockAbility {
  if (level <= SECURITY_LEVEL.NONE) return { available: false, method: platform === 'ios' ? 'Face ID' : 'fingerprint' };
  if (level >= SECURITY_LEVEL.BIOMETRIC_WEAK) {
    if (types.includes(AUTH_TYPE.FACIAL_RECOGNITION)) return { available: true, method: platform === 'ios' ? 'Face ID' : 'face unlock' };
    if (types.includes(AUTH_TYPE.FINGERPRINT)) return { available: true, method: platform === 'ios' ? 'Touch ID' : 'fingerprint' };
  }
  return { available: true, method: 'phone passcode' };
}

/** The person's choice: 'off' only when they switched it off. Unset is ON. */
export function lockWanted(saved: string | null): boolean {
  return saved !== 'off';
}

export type LockFacts = {
  wanted: boolean;
  available: boolean;
  signedIn: boolean;
  preview: boolean;
  /** When the app was last in use; null when unknown (a fresh launch with nothing recorded). */
  lastActiveAt: number | null;
  now: number;
};

/** Lock now? Unknown time away counts as long away. */
export function shouldLock(f: LockFacts): boolean {
  if (!f.wanted || !f.available || !f.signedIn || f.preview) return false;
  if (f.lastActiveAt === null) return true;
  return f.now - f.lastActiveAt >= LOCK_AFTER_MS;
}
