#!/usr/bin/env node
// api-inventory.js — writes docs/api-inventory.md from the AMS source.
//
//   node scripts/api-inventory.js ../icsa-system            (Run on Mac, from icsa-mobile/)
//
// Reads server/src/index.js (the /api mounts and the upload endpoints written
// inline there) and every server/src/routes/*.js, and lists each endpoint with
// the roles its route line admits and whether a STUDENT token can reach it.
// The student column uses the firewall's own rule (studentFirewall.isAllowed:
// exact path, or prefix when the entry ends in '*'), applied to the path with
// each :param filled in — so an entry that names a :param literally shows as
// unreachable, which is what the server does with it.
//
// Regenerate this file; never edit docs/api-inventory.md by hand.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AMS = path.resolve(process.argv[2] || '../icsa-system');
const SRC = path.join(AMS, 'server', 'src');
const OUT = path.join(__dirname, '..', 'docs', 'api-inventory.md');
if (!fs.existsSync(path.join(SRC, 'index.js'))) {
  console.error('COULD NOT RUN: no AMS at ' + AMS + ' (pass the icsa-system folder)');
  process.exit(2);
}
const strip = (s) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const idx = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8');
const mounts = [...idx.matchAll(/app\.use\(\s*'(\/api[^']*)'\s*,\s*require\('\.\/routes\/([^']+)'\)/g)]
  .map((m) => ({ prefix: m[1], file: m[2] }));
const fw = fs.readFileSync(path.join(SRC, 'middleware', 'studentFirewall.js'), 'utf8');
const allow = [...fw.matchAll(/\{\s*method:\s*'(\w+)',\s*path:\s*'([^']+)'/g)].map((m) => ({ method: m[1], path: m[2] }));
const isAllowed = (method, p) => allow.some((e) => e.method === method
  && (e.path.endsWith('*') ? p.startsWith(e.path.slice(0, -1)) : p === e.path));
const sample = (p) => p.replace(/:[A-Za-z_]+/g, 'x1');

const rows = [];
for (const { prefix, file } of mounts) {
  const fp = path.join(SRC, 'routes', file.endsWith('.js') ? file : file + '.js');
  if (!fs.existsSync(fp)) continue;
  const src = strip(fs.readFileSync(fp, 'utf8'));
  const consts = {};
  for (const m of src.matchAll(/const\s+([A-Za-z_]+)\s*=\s*\[?\s*(?:auth\s*,\s*)?authorize\(([^)]*)\)/g)) consts[m[1]] = m[2];
  const re = /router\s*\.\s*(get|post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 1, s = '';
    while (i < src.length && depth) { const c = src[i]; if (c === '(') depth++; else if (c === ')') depth--; if (depth) s += c; i++; }
    const pm = s.match(/^\s*['"`]([^'"`]+)['"`]/);
    if (!pm) continue;
    const rest = s.slice(pm[0].length);
    let roles = [...rest.matchAll(/authorize\(([^)]*)\)/g)].map((x) => x[1]).join(' | ');
    if (!roles) for (const k of Object.keys(consts)) if (new RegExp('\\b' + k + '\\b').test(rest)) roles = consts[k];
    roles = roles.replace(/['"\s]/g, '').replace(/,/g, ', ');
    const authed = /\bauth\b/.test(rest) || /router\.use\(\s*auth\b/.test(src);
    const full = (prefix + (pm[1] === '/' ? '' : pm[1])).replace(/\/+$/, '') || prefix;
    const method = m[1].toUpperCase();
    rows.push({ area: prefix, method, path: full, roles: roles || (authed ? 'any signed-in' : 'PUBLIC'), student: isAllowed(method, sample(full)) });
  }
}
for (const m of strip(idx).matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/api[^']+)'\s*,([^\n]*)/g)) {
  if (/express\.json/.test(m[3])) continue;
  const gate = (m[3].match(/auth,\s*([A-Za-z]+)/) || [])[1] || (/\bauth\b/.test(m[3]) ? 'any signed-in' : 'PUBLIC');
  const method = m[1].toUpperCase();
  rows.push({ area: '/api/upload (index.js)', method, path: m[2], roles: gate, student: isAllowed(method, sample(m[2])) });
}
// Allowlist entries that can never match a real request (a literal :param).
const dead = allow.filter((e) => !e.path.endsWith('*') && /:[A-Za-z_]/.test(e.path));

let commit = '';
try { commit = execSync('git -C "' + AMS + '" rev-parse --short HEAD').toString().trim(); } catch (_) { commit = 'unknown'; }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const d = new Date();
const today = d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
const esc = (x) => String(x).replace(/\|/g, '\\|');
const areas = {};
rows.forEach((r) => { (areas[r.area] = areas[r.area] || []).push(r); });

let out = '# AMS API inventory\n\n'
  + 'Generated ' + today + ' from the AMS at commit `' + commit + '` by `scripts/api-inventory.js`. '
  + '**' + rows.length + ' endpoints**, ' + rows.filter((r) => r.student).length + ' reachable with a student token. '
  + 'Regenerate it; never edit it by hand — a hand-kept list drifts.\n\n'
  + '- **Roles** — what the route line\'s `authorize(...)` admits. Overlay roles count (a supervisor with the marketer overlay passes `marketer`). '
  + 'The controller usually narrows further (own branch, own students, own leads): the route gate is the outer wall, not the whole rule.\n'
  + '- **any signed-in** — `auth` with no role gate on the route line; the controller decides.\n'
  + '- **PUBLIC** — no `auth` on the route line (website forms, verification, health); some check a secret or token inside.\n'
  + '- **Student ✓** — a student token reaches it. The firewall (`server/src/middleware/studentFirewall.js`, ' + allow.length
  + ' entries) refuses a student on every other path, whatever the route says. A new student screen needs a new allowlist line on the server.\n'
  + '- Base URL: `https://app.icsasystem.com`; the token travels as `Authorization: Bearer <token>`.\n';
if (dead.length) {
  out += '\n> ⚠️ **' + dead.length + ' allowlist entr' + (dead.length === 1 ? 'y names' : 'ies name') + ' a `:param` literally and can never match a real request**, so students get a 403 there: '
    + dead.map((e) => '`' + e.method + ' ' + e.path + '`').join(', ') + '. Found while preparing this inventory; not fixed.\n';
}
out += '\n## Areas\n\n' + Object.keys(areas).map((a) => '- `' + a + '` — ' + areas[a].length).join('\n') + '\n';
for (const [a, rs] of Object.entries(areas)) {
  out += '\n## `' + a + '`\n\n| Method | Path | Roles | Student |\n|---|---|---|---|\n'
    + rs.map((r) => '| ' + r.method + ' | `' + esc(r.path) + '` | ' + esc(r.roles) + ' | ' + (r.student ? '✓' : '') + ' |').join('\n') + '\n';
}
fs.writeFileSync(OUT, out);
console.log('wrote ' + OUT + ': ' + rows.length + ' endpoints, ' + rows.filter((r) => r.student).length + ' student-reachable, '
  + dead.length + ' dead allowlist entr' + (dead.length === 1 ? 'y' : 'ies'));
if (rows.length < 400) { console.error('COULD NOT RUN: only ' + rows.length + ' endpoints found — the parse is broken'); process.exit(2); }
