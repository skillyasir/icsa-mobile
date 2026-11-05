// May this app version run? The AMS says the lowest version allowed per
// platform (GET /api/mobile/config, S4, 5 Nov 2026 — set on the AMS Settings
// page). Below it, the app shows an Update screen and goes no further: the
// phone's version of the AMS rule that a stale bundle gets a loud error rather
// than running old logic against a new server.
//
// FAIL OPEN, like the server: no answer, no minimum, or a version that cannot
// be read means "carry on". A gate that shuts on a weak signal or a typo locks
// out the people it exists to protect.

export type Triple = [number, number, number];

/** "1" / "1.2" / "1.2.3" → [1, 2, 3]; anything else → null. */
export function parseVersion(v: string | null | undefined): Triple | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!/^\d{1,4}(\.\d{1,4}){0,2}$/.test(t)) return null;
  const p = t.split('.').map(Number);
  while (p.length < 3) p.push(0);
  return [p[0], p[1], p[2]];
}

/** a < b, part by part. */
export function isOlder(a: Triple, b: Triple): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export type AppConfig = { min_version?: { ios?: string | null; android?: string | null } };

/** 'update' only when the AMS named a minimum and this version is provably below it. */
export function gateFor(config: AppConfig | null, platform: 'ios' | 'android', appVersion: string | null): 'ok' | 'update' {
  const min = parseVersion(config?.min_version?.[platform] ?? null);
  const mine = parseVersion(appVersion);
  if (!min || !mine) return 'ok';
  return isOlder(mine, min) ? 'update' : 'ok';
}
