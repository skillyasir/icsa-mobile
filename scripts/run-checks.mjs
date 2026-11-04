// Runs every *.check.ts under src/ and scripts/, each in its own Node process
// (Node strips the TypeScript types — Node 22.18+ or 24).
//
//   npm run checks            run them all
//   echo "exit=$?"            0 all passed · 1 an assertion failed · 2 a check could not run
//
// "Could not run" outranks "failed": a check that could not run told you
// nothing while looking like it had. Same rule as the AMS's run-checks.js.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['node_modules', '.git', '.expo', 'ios', 'android', 'dist']);

function find(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) find(p, out);
    else if (name.endsWith('.check.ts')) out.push(p);
  }
  return out;
}

const files = ['src', 'scripts'].flatMap((d) => find(join(ROOT, d))).sort();
console.log(`${files.length} check file(s)\n`);
if (files.length === 0) {
  console.log('No checks found — that is a failure of the runner, not a pass.');
  process.exit(2);
}

const failed = [];
const couldNotRun = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [f], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(r.stdout ?? '');
  process.stderr.write(r.stderr ?? '');
  const rel = relative(ROOT, f);
  if (r.status === 0) continue;
  if (r.status === 1) failed.push(rel);
  else couldNotRun.push(`${rel} (exit ${r.status ?? r.signal})`);
}

console.log(`\n${files.length - failed.length - couldNotRun.length} passed · ${failed.length} failed · ${couldNotRun.length} could not run`);
for (const f of failed) console.log(`  FAILED        ${f}`);
for (const f of couldNotRun) console.log(`  COULD NOT RUN ${f}`);
process.exit(couldNotRun.length ? 2 : failed.length ? 1 : 0);
