// Where the checks find the AMS working copy, to hold the app's copy of an AMS
// rule to the AMS's own. Beside this repo by default (~/Projects/icsa-system
// next to ~/Projects/icsa-mobile); ICSA_SYSTEM_DIR overrides.
//
// Missing is a COULD NOT RUN (the check throws, exit 2), never a pass: a check
// that cannot see the AMS has not compared anything.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = new URL('..', import.meta.url).pathname;

export function amsDir(): string {
  return process.env.ICSA_SYSTEM_DIR ?? resolve(REPO, '..', 'icsa-system');
}

export function readAmsFile(rel: string): string {
  const p = resolve(amsDir(), rel);
  if (!existsSync(p)) {
    throw new Error(`the AMS copy is not where this check looks: ${p} (set ICSA_SYSTEM_DIR)`);
  }
  return readFileSync(p, 'utf8');
}

/**
 * The AMS student firewall's OWN matcher, run here: its allowlist entries and
 * its pathMatches function, both read from studentFirewall.js (8 Nov 2026 —
 * when the AMS taught ':name' to match one path part, a copy of the old
 * matcher in a check would have gone on answering the old question). A file
 * without the function is a COULD NOT RUN, never a guess.
 */
export function amsFirewallAdmits(): (method: string, path: string) => boolean {
  const raw = readAmsFile('server/src/middleware/studentFirewall.js');
  const src = raw.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
  const fn = /function pathMatches\(entryPath, path\) \{[\s\S]*?\n\}/.exec(src)?.[0];
  if (!fn) throw new Error('the AMS firewall has no pathMatches function — is the AMS copy older than 8 Nov 2026?');
  const pathMatches = new Function(`${fn}; return pathMatches;`)() as (entry: string, path: string) => boolean;
  const list = /const STUDENT_ALLOWLIST = \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? '';
  const entries = [...list.matchAll(/\{\s*method:\s*'([A-Z]+)',\s*path:\s*'([^']+)'\s*\}/g)].map((m) => ({ method: m[1], path: m[2] }));
  if (entries.length < 30) throw new Error(`the AMS firewall's allowlist read as ${entries.length} entries`);
  return (method, path) => entries.some((e) => e.method === method && pathMatches(e.path, path));
}
