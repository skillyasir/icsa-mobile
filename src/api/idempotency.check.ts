import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { readAmsFile } from '../../scripts/ams.ts';
import { runAsync } from '../../scripts/check-harness.ts';

import { IDEMPOTENCY_HEADER, IDEMPOTENT_ROUTES, PressKey, V4_RE, mayAlreadyBeSaved, newIdempotencyKey, sameKeyMayRetry } from './idempotency.ts';
import { SessionClient, type Failure } from './session.ts';

// One press, one write (AMS S5, cf6f4fa1, 13 Nov 2026): the app's keys, held
// to the AMS's own middleware (server/src/middleware/idempotency.js) and to the
// routes that take one.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const fail = (f: Partial<Failure>): Failure => ({ kind: 'refused', message: 'x', ...f });

runAsync('idempotency.check — one press, one write, as the AMS takes it', async (h) => {
  // §1 the AMS's middleware: the header, the version 4 rule, the four codes
  const mw = strip(readAmsFile('server/src/middleware/idempotency.js'));
  h.check('§1 the AMS middleware was read (floor)', mw.length > 3000, String(mw.length));
  h.check('§1 the header is the AMS’s', new RegExp(`const HEADER = '${IDEMPOTENCY_HEADER}'`).test(mw));
  const amsV4 = /const UUID_V4 = (\/.+\/i);/.exec(mw)?.[1];
  h.check('§1 the AMS accepts only a version 4 UUID — the same rule as here', amsV4 === String(V4_RE), `${amsV4} vs ${String(V4_RE)}`);
  h.check('§1 the AMS answers the four codes this app reads', ['IDEMPOTENCY_KEY_INVALID', 'IDEMPOTENCY_UNAVAILABLE', 'IN_PROGRESS', 'IDEMPOTENCY_MISMATCH'].every((c) => mw.includes(`code: '${c}'`)));

  // §2 the eight routes, as the AMS wraps them (a census both ways)
  const files = ['students', 'enrollments', 'payments', 'refunds', 'paymentProofs'].map((f) => ({ f, src: strip(readAmsFile(`server/src/routes/${f}.js`)) }));
  const mounts: Record<string, string> = { students: '/students', enrollments: '/enrollments', payments: '/payments', refunds: '/refunds', paymentProofs: '/payment-proofs' };
  const wrapped = files.flatMap(({ f, src }) =>
    [...src.matchAll(/router\.post\('([^']*)',[^;]*\bidempotent\b/g)].map((m) => (mounts[f] + (m[1] === '/' ? '' : m[1])).replace(/\/$/, '')),
  );
  const ROUTES_HERE = [...IDEMPOTENT_ROUTES].sort();
  h.check('§2 the AMS wraps exactly the eight routes this app keys (no more, no fewer)', JSON.stringify([...wrapped].sort()) === JSON.stringify(ROUTES_HERE), wrapped.sort().join(', '));

  // §3 the keys
  const keys = Array.from({ length: 2000 }, () => newIdempotencyKey());
  h.check('§3 every key is a version 4 UUID (2,000 made)', keys.every((k) => V4_RE.test(k)));
  h.check('§3 …and no two are the same', new Set(keys).size === keys.length);
  h.check('§3 V4_RE refuses a version 1 UUID and a bare string', !V4_RE.test('6fa459ea-ee8a-11ca-9e16-0800200c9a66') && !V4_RE.test('not-a-key'));

  // §4 when the same key may be sent again
  h.check('§4 no answer: the same press may be retried with the same key', sameKeyMayRetry(fail({ kind: 'offline' })));
  h.check('§4 a 5xx and 503 IDEMPOTENCY_UNAVAILABLE: the same key again', sameKeyMayRetry(fail({ kind: 'server', status: 500 })) && sameKeyMayRetry(fail({ kind: 'server', status: 503, code: 'IDEMPOTENCY_UNAVAILABLE' })));
  h.check('§4 a 4xx is final for the key (fix it: a new press)', !sameKeyMayRetry(fail({ status: 400 })) && !sameKeyMayRetry(fail({ status: 422, code: 'IDEMPOTENCY_MISMATCH' })));
  h.check('§4 409 IN_PROGRESS is never retried by the app — a person checks', !sameKeyMayRetry(fail({ status: 409, code: 'IN_PROGRESS' })) && mayAlreadyBeSaved(fail({ status: 409, code: 'IN_PROGRESS' })));
  const p = new PressKey();
  const k1 = p.current();
  p.settle(fail({ kind: 'offline' }));
  const k2 = p.current();
  p.settle(null);
  const k3 = p.current();
  p.settle(fail({ status: 400 }));
  const k4 = p.current();
  h.check('§4 PressKey: kept through a no-answer retry, new after a success and after a refusal', k1 === k2 && k3 !== k2 && k4 !== k3 && [k1, k3, k4].every((k) => V4_RE.test(k)));

  // §5 the wire: the header goes out, and the 401 retry re-sends the SAME key
  const seen: { path: string; key: string | null; auth: string | null }[] = [];
  let first = true;
  const stub = new SessionClient({
    apiUrl: 'https://x/api',
    store: { get: async () => 'refresh-token', set: async () => {}, remove: async () => {} },
    device: { platform: 'ios', deviceName: null, appVersion: null },
    fetch: async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const path = url.replace('https://x/api', '');
      if (path.startsWith('/mobile/session/refresh')) {
        return new Response(JSON.stringify({ token: 'T' + seen.length, refresh_token: 'R', session: { idleMinutes: 30 } }), { status: 200 });
      }
      seen.push({ path, key: headers[IDEMPOTENCY_HEADER] ?? null, auth: headers.Authorization ?? null });
      if (first) {
        first = false;
        return new Response(JSON.stringify({ error: 'expired' }), { status: 401 });
      }
      return new Response(JSON.stringify({ id: 'p1' }), { status: 201 });
    },
  });
  const key = newIdempotencyKey();
  const r = await stub.request<{ id: string }>('POST', '/payments', { amount: 1 }, { idempotencyKey: key });
  const pays = seen.filter((x) => x.path === '/payments');
  h.check('§5 the request was made, refused once (401) and retried (fixture)', pays.length === 2 && r.ok, JSON.stringify(seen));
  h.check('§5 both attempts carried the same key — a refreshed token never makes a second write', pays.every((x) => x.key === key));
  const plain = seen.length;
  await stub.request('GET', '/students');
  h.check('§5 a call without a key sends no Idempotency-Key header', seen.length === plain + 1 && seen[seen.length - 1].key === null);

  // §6 every money write in the app carries its key (a census of the call sites)
  const SRC = new URL('../', import.meta.url).pathname;
  const all: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const q = join(d, f);
      if (statSync(q).isDirectory()) walk(q);
      else if (/\.(ts|tsx)$/.test(f) && !/\.check\.ts$/.test(f)) all.push(q);
    }
  };
  walk(SRC);
  const tables = new Map<string, string>();
  for (const f of all) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const t of src.matchAll(/export const ([A-Z_]+) = \{([\s\S]*?)\} as const;/g)) {
      for (const e of t[2].matchAll(/(\w+): \{ method: 'POST', path: '([^']+)' \}/g)) tables.set(`${t[1]}.${e[1]}`, e[2]);
    }
  }
  const money = [...tables].filter(([, path]) => (IDEMPOTENT_ROUTES as readonly string[]).includes(path)).map(([k]) => k);
  h.check('§6 the API tables were read, and the money entries found in them (floor: 1)', tables.size >= 5 && money.length >= 1, `${tables.size} POST entries · money: ${money.join(', ')}`);
  const bare: string[] = [];
  let uses = 0;
  for (const f of all) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const k of money) {
      const [tab, key2] = k.split('.');
      for (const m of src.matchAll(new RegExp(`${tab}\\.${key2}\\.path`, 'g'))) {
        uses++;
        const around = src.slice(m.index, m.index + 900);
        if (!/idempotencyKey:|\[IDEMPOTENCY_HEADER\]:/.test(around)) bare.push(`${f.slice(SRC.length)} ${k}`);
      }
    }
  }
  h.check(`§6 every money write sends its key (${uses} use${uses === 1 ? '' : 's'})`, uses >= 1 && bare.length === 0, bare.join(' | '));
});
