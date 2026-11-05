import { readFileSync } from 'node:fs';

import { run } from '../../scripts/check-harness.ts';

import { gateFor, isOlder, parseVersion } from './version.ts';

// The update check (S4, 5 Nov 2026): below the AMS's lowest allowed version
// the app shows an Update screen; with no answer, no minimum or an unreadable
// version it carries on. The gate FAILS OPEN — the AMS's own endpoint does
// the same (mobile-sessions.check.js §5).

run('version.check — the update check stops only an app that is provably too old', (h) => {
  // §1 reading a version
  h.check('§1 "1.2.3" → [1,2,3]; "1.2" and "1" are padded', JSON.stringify([parseVersion('1.2.3'), parseVersion('1.2'), parseVersion(' 1 ')]) === '[[1,2,3],[1,2,0],[1,0,0]]');
  h.check('§1 not a version → null', ['', 'v1.2', '1,2', '1.2.3.4', '1.2.3-beta', 'latest', null, undefined].every((v) => parseVersion(v) === null));

  // §2 comparing: part by part, never as text ("1.10" is newer than "1.9")
  h.check('§2 1.9.0 is older than 1.10.0 (numbers, not text)', isOlder([1, 9, 0], [1, 10, 0]) && !isOlder([1, 10, 0], [1, 9, 0]));
  h.check('§2 the same version is not older', !isOlder([2, 0, 1], [2, 0, 1]));
  h.check('§2 a patch decides when the rest agree', isOlder([1, 2, 3], [1, 2, 4]));

  // §3 the gate
  const cfg = (ios: string | null, android: string | null) => ({ min_version: { ios, android } });
  h.check('§3 below the minimum → update', gateFor(cfg('1.2.0', null), 'ios', '1.1.9') === 'update');
  h.check('§3 at the minimum → ok', gateFor(cfg('1.2.0', null), 'ios', '1.2.0') === 'ok');
  h.check('§3 each platform reads its own minimum', gateFor(cfg('9.0.0', null), 'android', '1.0.0') === 'ok' && gateFor(cfg(null, '9.0.0'), 'android', '1.0.0') === 'update');
  h.check('§3 no answer from the AMS → ok (fail open)', gateFor(null, 'ios', '1.0.0') === 'ok');
  h.check('§3 no minimum set → ok', gateFor(cfg(null, null), 'ios', '0.0.1') === 'ok' && gateFor({}, 'ios', '0.0.1') === 'ok');
  h.check('§3 a minimum that is not a version → ok', gateFor(cfg('v2', null), 'ios', '1.0.0') === 'ok');
  h.check('§3 this app\'s version unknown → ok', gateFor(cfg('1.0.0', null), 'ios', null) === 'ok');

  // §4 the screen asks the AMS without a sign-in, and only a real answer can close it
  const gate = readFileSync(new URL('../gate/AppGate.tsx', import.meta.url), 'utf8');
  h.check('§4 extraction floor: AppGate.tsx read', gate.length > 1500, String(gate.length));
  h.check('§4 it asks GET /mobile/config through the public call (no token)', /ams\.publicGet<AppConfig>\('\/mobile\/config'\)/.test(gate));
  h.check('§4 only an answer the AMS gave can change the gate', /if \(live && r\.ok\) setGate\(gateFor\(r\.value, DEVICE\.platform, DEVICE\.appVersion\)\)/.test(gate));
  h.check('§4 it starts open', /useState<'ok' \| 'update'>\('ok'\)/.test(gate));
  const layout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const g = layout.indexOf('<AppGate>'), l = layout.indexOf('<LockProvider>');
  h.check('§4 the update check sits above the lock (an Update screen holds nobody\'s data)', g > 0 && l > g, `${g} / ${l}`);
});
