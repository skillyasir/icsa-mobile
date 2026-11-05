import { readFileSync } from 'node:fs';

import { run } from '../../scripts/check-harness.ts';

import { AUTH_TYPE, LOCK_AFTER_MS, SECURITY_LEVEL, lockAbility, lockWanted, shouldLock } from './lockRule.ts';

// The Face ID / fingerprint lock (S4, Yasir 5 Nov 2026): five minutes away,
// on for everyone who can, each person may switch it off, the phone's
// passcode when Face ID fails, "Sign in again" for anyone who cannot unlock.

run('lockRule.check — when ICSA locks, and with what', (h) => {
  const base = { wanted: true, available: true, signedIn: true, preview: false, lastActiveAt: 1_000_000, now: 1_000_000 };

  // §1 time away (Yasir: five minutes)
  h.check('§1 five minutes', LOCK_AFTER_MS === 5 * 60_000);
  h.check('§1 back after 4 min 59 s → not locked', !shouldLock({ ...base, now: base.lastActiveAt + LOCK_AFTER_MS - 1000 }));
  h.check('§1 back after exactly 5 min → locked', shouldLock({ ...base, now: base.lastActiveAt + LOCK_AFTER_MS }));
  h.check('§1 time away unknown (nothing recorded) → locked', shouldLock({ ...base, lastActiveAt: null }));

  // §2 who
  const long = { ...base, now: base.lastActiveAt + 60 * 60_000 };
  h.check('§2 switched off → never locked', !shouldLock({ ...long, wanted: false }));
  h.check('§2 a phone that cannot lock → never locked', !shouldLock({ ...long, available: false }));
  h.check('§2 nobody signed in → never locked', !shouldLock({ ...long, signedIn: false }));
  h.check('§2 the developer preview → never locked', !shouldLock({ ...long, preview: true }));
  h.check('§2 ON unless the person switched it off (Yasir: everyone, on)', lockWanted(null) && lockWanted('on') && !lockWanted('off'));

  // §3 what the phone can do, by name
  const { FINGERPRINT: FP, FACIAL_RECOGNITION: FACE } = AUTH_TYPE;
  const { NONE, SECRET, BIOMETRIC_WEAK, BIOMETRIC_STRONG } = SECURITY_LEVEL;
  h.check('§3 iPhone with Face ID', JSON.stringify(lockAbility('ios', [FACE], BIOMETRIC_STRONG)) === '{"available":true,"method":"Face ID"}');
  h.check('§3 iPhone with Touch ID', lockAbility('ios', [FP], BIOMETRIC_STRONG).method === 'Touch ID');
  h.check('§3 Android with a fingerprint', lockAbility('android', [FP], BIOMETRIC_STRONG).method === 'fingerprint');
  h.check('§3 Android with weak face unlock', lockAbility('android', [FACE], BIOMETRIC_WEAK).method === 'face unlock');
  h.check('§3 a passcode and nothing else → the passcode locks it', JSON.stringify(lockAbility('android', [FP], SECRET)) === '{"available":true,"method":"phone passcode"}');
  h.check('§3 no passcode at all → cannot lock', !lockAbility('ios', [FACE], NONE).available && !lockAbility('android', [], NONE).available);

  // §4 the numbers copied here are expo-local-authentication's own
  const types = readFileSync(new URL('../../node_modules/expo-local-authentication/build/LocalAuthentication.types.d.ts', import.meta.url), 'utf8');
  const num = (name: string) => Number((new RegExp(`\\b${name} = (\\d+)`).exec(types) ?? [])[1]);
  h.check('§4 extraction floor: the package\'s types are read', types.length > 1000 && Number.isFinite(num('FINGERPRINT')));
  h.check('§4 the authentication types match the package', FP === num('FINGERPRINT') && FACE === num('FACIAL_RECOGNITION') && AUTH_TYPE.IRIS === num('IRIS'));
  h.check('§4 the security levels match the package', NONE === num('NONE') && SECRET === num('SECRET') && BIOMETRIC_WEAK === num('BIOMETRIC_WEAK') && BIOMETRIC_STRONG === num('BIOMETRIC_STRONG'));

  // §5 the phone side keeps the rules lockRule cannot see
  const p = readFileSync(new URL('./LockProvider.tsx', import.meta.url), 'utf8');
  h.check('§5 extraction floor: LockProvider.tsx read', p.length > 4000, String(p.length));
  h.check("§5 the phone's passcode is offered when Face ID fails (Yasir)", (p.match(/disableDeviceFallback: false/g) ?? []).length === 2);
  h.check('§5 only time in the BACKGROUND counts as away — the Face ID prompt itself must not re-lock (Cancel would loop for ever)',
    /if \(s === 'background'\) \{\s*beenAway\.current = true;/.test(p) && /if \(back && lockable && shouldLock\(/.test(p));
  h.check('§5 never a second prompt over the first', /if \(prompting\.current\) return;\s*prompting\.current = true;/.test(p));
  h.check('§5 "Sign in again" is on the lock screen', /title="Sign in again"/.test(p));
  h.check('§5 the screen is covered for the app switcher, and hidden from screen readers while locked',
    /if \(s === 'inactive'\) \{[\s\S]{0,160}setCovered\(true\)/.test(p) && /accessibilityElementsHidden=\{hide\}/.test(p));
  h.check('§5 signing out forgets the choice, so the next person starts with the lock on', /save\(WANTED_KEY, null\);\s*setWantedState\(true\);/.test(p));
});
