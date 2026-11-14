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

// ── Reading one declaration out of an AMS file (moved here from money.check.ts,
// 14 Nov 2026, so every check that runs AMS code uses the one extractor;
// money.check §0 self-tests it on the awkward shapes before any use).

/** Index just past the bracket that closes the one at `i`, skipping strings, templates and comments. */
export function closeOf(src: string, i: number): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '/' && src[k + 1] === '/') {
      k = src.indexOf('\n', k);
      if (k < 0) return -1;
      continue;
    }
    if (c === '/' && src[k + 1] === '*') {
      k = src.indexOf('*/', k) + 1;
      continue;
    }
    if (c === "'" || c === '"') {
      k++;
      while (k < src.length && src[k] !== c) {
        if (src[k] === '\\') k++;
        k++;
      }
      continue;
    }
    if (c === '`') {
      k++;
      while (k < src.length && src[k] !== '`') {
        if (src[k] === '\\') k += 2;
        else if (src[k] === '$' && src[k + 1] === '{') k = closeOf(src, k + 1);
        else k++;
      }
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return k + 1;
    }
  }
  return -1;
}

/** A top-level declaration's whole source by name: `[export] [async] function name(…) {…}` or `[export] const name = …;`. */
export function declOf(src: string, name: string): string {
  const fn = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(src);
  if (fn) {
    const paramsEnd = closeOf(src, fn.index + fn[0].length - 1);
    if (paramsEnd < 0) return '';
    const open = src.indexOf('{', paramsEnd);
    const end = closeOf(src, open);
    return end < 0 ? '' : src.slice(fn.index, end).replace(/^export\s+/, '');
  }
  const cn = new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=`).exec(src);
  if (!cn) return '';
  for (let k = cn.index + cn[0].length; k < src.length; k++) {
    const c = src[k];
    if (c === '(' || c === '[' || c === '{') {
      const e = closeOf(src, k);
      if (e < 0) return '';
      k = e - 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // a string at the top level of the expression: skip to its closing quote
      k++;
      while (k < src.length && src[k] !== c) {
        if (src[k] === '\\') k++;
        k++;
      }
      continue;
    }
    if (c === ';') return src.slice(cn.index, k + 1).replace(/^export\s+/, '');
  }
  return '';
}

