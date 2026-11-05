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
