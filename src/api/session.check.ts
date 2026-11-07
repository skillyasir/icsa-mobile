import { runAsync, type Harness } from '../../scripts/check-harness.ts';

import {
  MESSAGES,
  REFRESH_TOKEN_KEY,
  SessionClient,
  failureOfAnswer,
  type FetchLike,
  type TokenStore,
} from './session.ts';

// The session client against a stand-in AMS that behaves like S2 (live
// 4 Nov 2026): the login, POST /mobile/session, a refresh that ROTATES with a
// 120 s grace for the old token and signs the phone out when an old token
// comes back later, sign-out, /auth/me, and an access token that runs out
// after idle minutes + 120 s. Faults are planted per path.
//
// This checks the app's half. The AMS's half was rehearsed against a real
// PostgreSQL on 4 Nov 2026 (mobile-sessions.check.js in the AMS).

type Call = { method: string; path: string; auth: string | null; body: Record<string, unknown> };
type Fault = 'offline' | 'hang' | { status: number; json?: object; text?: string };

class FakeAms {
  clock = 1_000_000;
  calls: Call[] = [];
  faults = new Map<string, Fault>();
  private n = 0;
  private access = new Map<string, { userId: string; expires: number }>();
  devices: { userId: string; current: string; prev: string | null; rotatedAt: number; revoked: string | null }[] = [];
  users: Record<string, { id: string; full_name: string; email: string; role: string; branch_name: string; overlay_roles: string[]; student_code?: string }> = {
    'maria@example.com': { id: 'u-staff', full_name: 'Maria Santos', email: 'maria@example.com', role: 'teacher', branch_name: 'Kuwait City', overlay_roles: ['marketer'] },
    'STU-12611041': { id: 'u-stu', full_name: 'Ali Hassan', email: 'ali@example.com', role: 'student', branch_name: 'Mahboula', overlay_roles: [], student_code: 'STU-12611041' },
  };

  token(prefix: string) {
    this.n++;
    return `${prefix}${String(this.n).padStart(40 - prefix.length, '0')}xyz`;
  }
  private issueAccess(userId: string) {
    const t = this.token('acc-');
    this.access.set(t, { userId, expires: this.clock + 10 * 60_000 + 120_000 });
    return t;
  }
  private who(auth: string | null) {
    const a = auth ? this.access.get(auth) : undefined;
    return a && a.expires > this.clock ? a.userId : null;
  }
  private userById(id: string) {
    return Object.values(this.users).find((u) => u.id === id)!;
  }

  fetch: FetchLike = async (url, init) => {
    const path = url.replace('https://ams.test/api', '');
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const auth = init.headers.Authorization?.replace(/^Bearer /, '') ?? null;
    this.calls.push({ method: init.method, path, auth, body });
    const fault = this.faults.get(path);
    const reply = (status: number, json?: object, text?: string) => ({ status, text: async () => text ?? JSON.stringify(json ?? {}) });
    if (fault === 'offline') throw new TypeError('Network request failed');
    if (fault === 'hang') return new Promise<never>(() => {});
    if (fault) return reply(fault.status, fault.json, fault.text);

    const session = { idleMinutes: 10 };
    if (path === '/auth/login' || path === '/auth/student-login') {
      const id = String(path === '/auth/login' ? body.email : body.student_code);
      const u = this.users[id];
      if (!u || body.password !== 'right' || !body.turnstileToken) return reply(401, { error: 'Invalid email or password' });
      return reply(200, { token: this.issueAccess(u.id), session, user: u });
    }
    if (path === '/mobile/session') {
      const uid = this.who(auth);
      if (!uid) return reply(401, { error: 'No token' });
      const rt = this.token('rt-');
      this.devices.push({ userId: uid, current: rt, prev: null, rotatedAt: 0, revoked: null });
      return reply(201, { device_id: 'd' + this.devices.length, refresh_token: rt, session_days: 30 });
    }
    if (path === '/mobile/session/refresh') {
      const t = String(body.refresh_token);
      const cur = this.devices.find((d) => d.current === t);
      const old = this.devices.find((d) => d.prev === t);
      const d = cur ?? old;
      if (!d) return reply(401, { code: 'SESSION_INVALID', error: 'Please sign in again.' });
      if (d.revoked) return reply(401, { code: 'SESSION_REVOKED', error: 'This phone was signed out. Please sign in again.' });
      if (!cur && this.clock - d.rotatedAt > 120_000) {
        d.revoked = 'token_reuse';
        return reply(401, { code: 'SESSION_REVOKED', error: 'This phone was signed out. Please sign in again.' });
      }
      const next = this.token('rt-');
      if (cur) {
        d.prev = d.current;
        d.rotatedAt = this.clock;
      }
      d.current = next;
      return reply(200, { token: this.issueAccess(d.userId), refresh_token: next, session });
    }
    if (path === '/mobile/session/signout') {
      const t = String(body.refresh_token);
      const d = this.devices.find((x) => !x.revoked && (x.current === t || x.prev === t));
      if (d) d.revoked = 'signed_out';
      return reply(200, { ok: true, signed_out: !!d });
    }
    if (path === '/auth/me') {
      const uid = this.who(auth);
      return uid ? reply(200, { user: this.userById(uid) }) : reply(401, { error: 'Token expired' });
    }
    if (path === '/probe') {
      return this.who(auth) ? reply(200, { fine: true }) : reply(401, { error: 'Token expired' });
    }
    return reply(404, { error: 'Route not found' });
  };

  count(path: string) {
    return this.calls.filter((c) => c.path === path).length;
  }
}

class MemStore implements TokenStore {
  data = new Map<string, string>();
  writes: string[] = [];
  failSet = false;
  async get(k: string) {
    return this.data.get(k) ?? null;
  }
  async set(k: string, v: string) {
    if (this.failSet) throw new Error('keychain unavailable');
    this.writes.push(k);
    this.data.set(k, v);
  }
  async remove(k: string) {
    this.data.delete(k);
  }
}

function setup(opts: { timeoutMs?: number } = {}) {
  const ams = new FakeAms();
  const store = new MemStore();
  const client = new SessionClient({
    apiUrl: 'https://ams.test/api',
    fetch: (u, i) => ams.fetch(u, i),
    store,
    device: { platform: 'ios', deviceName: 'iPhone 18 Pro', appVersion: '1.0.0' },
    now: () => ams.clock,
    timeoutMs: opts.timeoutMs ?? 50,
  });
  const ended: string[] = [];
  client.onSessionEnded((f) => ended.push(f.kind));
  return { ams, store, client, ended };
}

const staff = { path: '/auth/login', body: { email: 'maria@example.com', password: 'right', turnstileToken: 'tok' } };
const student = { path: '/auth/student-login', body: { student_code: 'STU-12611041', password: 'right', turnstileToken: 'tok' } };

async function main(h: Harness) {
  // §1 sign in, staff
  {
    const { ams, store, client } = setup();
    const r = await client.signIn(staff);
    h.check('§1 a staff sign-in succeeds and returns the AMS user', r.ok && r.value.full_name === 'Maria Santos' && r.value.overlay_roles.join() === 'marketer');
    const bind = ams.calls.find((c) => c.path === '/mobile/session');
    h.check('§1 the phone session is started with the access token from the login', !!bind && !!bind.auth?.startsWith('acc-'));
    h.check('§1 …saying ios, the model, the app version', bind?.body.platform === 'ios' && bind?.body.device_name === 'iPhone 18 Pro' && bind?.body.app_version === '1.0.0');
    h.check('§1 the refresh token is saved, and it is the only thing saved', store.data.get(REFRESH_TOKEN_KEY) === ams.devices[0].current && store.data.size === 1);
    h.check('§1 the password goes to the login and nowhere else', ams.calls.filter((c) => JSON.stringify(c.body).includes('right')).map((c) => c.path).join() === '/auth/login');
    const probe = await client.request('GET', '/probe');
    h.check('§1 a request straight after uses the access token, no refresh', probe.ok && ams.count('/mobile/session/refresh') === 0);
  }

  // §2 sign in, student
  {
    const { client, ams } = setup();
    const r = await client.signIn(student);
    h.check('§2 a student signs in by code and keeps the code', r.ok && r.value.student_code === 'STU-12611041' && r.value.role === 'student');
    h.check('§2 asked /auth/student-login', ams.calls[0].path === '/auth/student-login');
  }

  // §3 a refused login
  {
    const { client, ams, store } = setup();
    const r = await client.signIn({ ...staff, body: { ...staff.body, password: 'wrong' } });
    h.check('§3 a wrong password → refused, with the server\'s own words', !r.ok && r.failure.kind === 'refused' && r.failure.message === 'Invalid email or password');
    h.check('§3 …no phone session asked for, nothing saved', ams.count('/mobile/session') === 0 && store.data.size === 0);
    ams.faults.set('/auth/login', { status: 409, json: { code: 'AMBIGUOUS_STUDENT', error: 'This email is shared. Please sign in with your enrolment number instead.' } });
    const r2 = await client.signIn(staff);
    h.check('§3 a shared student email → its message', !r2.ok && r2.failure.kind === 'refused' && r2.failure.code === 'AMBIGUOUS_STUDENT' && /enrolment number/.test(r2.failure.message));
    ams.faults.set('/auth/login', 'offline');
    const r3 = await client.signIn(staff);
    h.check('§3 no signal → offline, not "wrong password"', !r3.ok && r3.failure.kind === 'offline' && r3.failure.message === MESSAGES.offline);
    ams.faults.set('/auth/login', { status: 502, text: '<html>Bad gateway</html>' });
    const r4 = await client.signIn(staff);
    h.check('§3 an HTML error page → server fault, read without throwing', !r4.ok && r4.failure.kind === 'server' && r4.failure.status === 502);
  }

  // §4 the phone session cannot be started
  {
    const { client, ams, store } = setup();
    ams.faults.set('/mobile/session', { status: 500, json: { error: 'Internal server error' } });
    const r = await client.signIn(staff);
    h.check('§4 /mobile/session fails → the sign-in fails, nothing saved, no access kept', !r.ok && r.failure.kind === 'server' && store.data.size === 0 && !client.hasAccessToken);
  }

  // §5 the phone cannot keep the token
  {
    const { client, ams, store } = setup();
    store.failSet = true;
    const r = await client.signIn(staff);
    h.check('§5 the Keychain refuses → storage failure', !r.ok && r.failure.kind === 'storage');
    const out = ams.calls.find((c) => c.path === '/mobile/session/signout');
    h.check('§5 …and the server is told to end the session it just made', !!out && out.body.refresh_token === ams.devices[0].current && ams.devices[0].revoked === 'signed_out');
    h.check('§5 …and no access token is kept', !client.hasAccessToken);
  }

  // §6 the access token runs out, and is renewed before it does
  {
    const { client, ams, store } = setup();
    await client.signIn(staff);
    const first = store.data.get(REFRESH_TOKEN_KEY);
    ams.clock += 11 * 60_000 + 30_000; // inside the last minute of the 12
    const r = await client.request('GET', '/probe');
    h.check('§6 near the end, a request renews first and then succeeds', r.ok && ams.count('/mobile/session/refresh') === 1);
    const now = store.data.get(REFRESH_TOKEN_KEY);
    h.check('§6 the rotated refresh token is saved at once', !!now && now !== first && now === ams.devices[0].current);
    const refresh = ams.calls.find((c) => c.path === '/mobile/session/refresh');
    h.check('§6 the refresh carries the token in the body, never the URL, and no access token', !!refresh && refresh.body.refresh_token === first && !refresh.auth);
  }

  // §7 many requests at once renew once
  {
    const { client, ams } = setup();
    await client.signIn(staff);
    ams.clock += 13 * 60_000;
    const all = await Promise.all([1, 2, 3, 4, 5].map(() => client.request('GET', '/probe')));
    h.check('§7 five requests with a lapsed token → exactly one refresh', ams.count('/mobile/session/refresh') === 1, String(ams.count('/mobile/session/refresh')));
    h.check('§7 …and all five succeed', all.every((x) => x.ok));
    h.check('§7 …and the server never saw an old token come back (no token_reuse)', ams.devices[0].revoked === null);
  }

  // §8 a weak signal never signs anybody out
  for (const [label, fault] of [['no signal', 'offline'], ['a timeout', 'hang']] as const) {
    const { client, ams, store, ended } = setup();
    await client.signIn(staff);
    const saved = store.data.get(REFRESH_TOKEN_KEY);
    ams.clock += 13 * 60_000;
    ams.faults.set('/mobile/session/refresh', fault);
    const r = await client.request('GET', '/probe');
    h.check(`§8 ${label} on refresh → offline`, !r.ok && r.failure.kind === 'offline');
    h.check(`§8 ${label} → the saved sign-in is kept and nobody is told the session ended`, store.data.get(REFRESH_TOKEN_KEY) === saved && ended.length === 0);
    ams.faults.delete('/mobile/session/refresh');
    const again = await client.request('GET', '/probe');
    h.check(`§8 ${label} → when the signal is back, it carries on`, again.ok);
  }

  // §9 the server ends the session
  for (const code of ['SESSION_REVOKED', 'SESSION_EXPIRED', 'SESSION_INVALID', 'ACCOUNT_INACTIVE']) {
    const { client, ams, store, ended } = setup();
    await client.signIn(staff);
    ams.clock += 13 * 60_000;
    ams.faults.set('/mobile/session/refresh', { status: 401, json: { code, error: 'This phone was signed out. Please sign in again.' } });
    const r = await client.request('GET', '/probe');
    h.check(`§9 ${code} → signed out, token forgotten, told once`, !r.ok && r.failure.kind === 'signed_out' && store.data.size === 0 && ended.join() === 'signed_out' && !client.hasAccessToken);
  }
  {
    const { client, ams, store, ended } = setup();
    await client.signIn(student);
    ams.clock += 13 * 60_000;
    ams.faults.set('/mobile/session/refresh', { status: 409, json: { code: 'AMBIGUOUS_STUDENT', error: 'This email is shared.' } });
    const r = await client.request('GET', '/probe');
    h.check('§9 AMBIGUOUS_STUDENT (409) → signed out too', !r.ok && r.failure.kind === 'signed_out' && store.data.size === 0 && ended.length === 1);
  }

  // §10 server faults are not a sign-out
  for (const [label, fault] of [
    ['a 500', { status: 500, json: { error: 'Internal server error' } }],
    ['a 404 (a route that went missing)', { status: 404, json: { error: 'Route not found' } }],
    ['a 502 HTML page', { status: 502, text: '<html>' }],
  ] as const) {
    const { client, ams, store, ended } = setup();
    await client.signIn(staff);
    ams.clock += 13 * 60_000;
    ams.faults.set('/mobile/session/refresh', fault);
    const r = await client.request('GET', '/probe');
    h.check(`§10 ${label} on refresh → server fault, sign-in kept`, !r.ok && r.failure.kind === 'server' && store.data.size === 1 && ended.length === 0);
  }
  {
    const { client, ams, store } = setup();
    await client.signIn(staff);
    ams.clock += 13 * 60_000;
    ams.faults.set('/mobile/session/refresh', { status: 429, json: { code: 'RATE_LIMITED', error: 'Too many requests. Please try again in a few minutes.' } });
    const r = await client.request('GET', '/probe');
    h.check('§10 a 429 → rate limited, its message, sign-in kept', !r.ok && r.failure.kind === 'rate_limited' && /Too many/.test(r.failure.message) && store.data.size === 1);
  }

  // §11 a 401 from a normal request: one fresh token, one retry, no loop
  {
    const { client, ams } = setup();
    await client.signIn(staff);
    const realFetch = ams.fetch;
    let probes = 0;
    ams.fetch = async (url, init) => {
      if (url.endsWith('/probe')) {
        probes++;
        return { status: 401, text: async () => JSON.stringify({ error: 'Token expired' }) };
      }
      return realFetch(url, init);
    };
    const before = ams.count('/mobile/session/refresh');
    const r = await client.request('GET', '/probe');
    h.check('§11 a 401 → exactly one refresh and exactly one retry', probes === 2 && ams.count('/mobile/session/refresh') === before + 1, `probes=${probes}`);
    h.check('§11 …then the refusal is reported, not looped on and not a sign-out', !r.ok && r.failure.kind === 'refused' && r.failure.status === 401);
  }

  // §12 sign out
  {
    const { client, ams, store } = setup();
    await client.signIn(staff);
    const saved = store.data.get(REFRESH_TOKEN_KEY);
    await client.signOut();
    h.check('§12 sign out forgets the token and the access token', store.data.size === 0 && !client.hasAccessToken);
    h.check('§12 …and tells the server, with that token', ams.calls.some((c) => c.path === '/mobile/session/signout' && c.body.refresh_token === saved) && ams.devices[0].revoked === 'signed_out');
  }
  {
    const { client, ams, store } = setup();
    await client.signIn(staff);
    ams.faults.set('/mobile/session/signout', 'hang');
    const pending = client.signOut();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    h.check('§12 with no answer from the server, the phone is signed out AT ONCE', store.data.size === 0 && !client.hasAccessToken);
    await pending;
    h.check('§12 …and the sign-out finishes when the request times out', store.data.size === 0);
  }

  // §13 signing out while a refresh is on the wire does not bring the session back
  {
    const { client, ams, store } = setup();
    await client.signIn(staff);
    ams.clock += 13 * 60_000;
    const realFetch = ams.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    ams.fetch = async (url, init) => {
      const res = await realFetch(url, init);
      if (url.endsWith('/mobile/session/refresh')) await gate; // the server has rotated; the reply is late
      return res;
    };
    const inflight = client.refresh();
    await new Promise((r) => setTimeout(r, 0));
    await client.signOut();
    release();
    const r = await inflight;
    h.check('§13 the late refresh is thrown away: still signed out', !r.ok && r.failure.kind === 'signed_out' && store.data.size === 0 && !client.hasAccessToken);
    h.check('§13 …and the token it was given is ended on the server too',
      ams.devices[0].revoked !== null && ams.calls.filter((c) => c.path === '/mobile/session/signout').length === 2);
  }

  // §14 launch
  {
    const { client } = setup();
    const r = await client.restore();
    h.check('§14 nothing saved → no sign-in, no server call', r.ok && r.value === null);
  }
  {
    const first = setup();
    await first.client.signIn(student);
    // a new launch: a new client, the same Keychain and the same AMS
    const again = new SessionClient({ apiUrl: 'https://ams.test/api', fetch: first.ams.fetch, store: first.store, device: { platform: 'ios', deviceName: null, appVersion: null }, now: () => first.ams.clock, timeoutMs: 50 });
    first.ams.clock += 3 * 24 * 3600_000; // three days later
    const r = await again.restore();
    h.check('§14 a saved sign-in → renewed and the person read from /auth/me', r.ok && r.value?.full_name === 'Ali Hassan' && first.ams.count('/auth/me') === 1);
    first.ams.faults.set('/mobile/session/refresh', 'offline');
    const third = new SessionClient({ apiUrl: 'https://ams.test/api', fetch: first.ams.fetch, store: first.store, device: { platform: 'ios', deviceName: null, appVersion: null }, now: () => first.ams.clock, timeoutMs: 50 });
    const off = await third.restore();
    h.check('§14 launched with no signal → offline, and the saved sign-in is kept', !off.ok && off.failure.kind === 'offline' && first.store.data.size === 1);
  }

  // §15 an old token coming back after the grace is the server's sign-out, and the app obeys it
  {
    const { client, ams, store, ended } = setup();
    await client.signIn(staff);
    const stale = store.data.get(REFRESH_TOKEN_KEY)!;
    ams.clock += 13 * 60_000;
    await client.request('GET', '/probe'); // rotates
    ams.clock += 5 * 60_000;
    await store.set(REFRESH_TOKEN_KEY, stale); // e.g. a restored backup
    ams.clock += 13 * 60_000;
    const r = await client.request('GET', '/probe');
    h.check('§15 the server signs the phone out; the app forgets and says so', !r.ok && r.failure.kind === 'signed_out' && store.data.size === 0 && ended.length === 1 && ams.devices[0].revoked === 'token_reuse');
  }

  // §16 the public call (the app's config, S4): no token, and no answer is
  // just a failure — the gate reading it fails open (version.check.ts)
  {
    const { client, ams, store, ended } = setup();
    await client.signIn(staff);
    ams.fetch = async (url, init) => ({ status: 200, text: async () => JSON.stringify({ min_version: { ios: '1.0.0', android: null }, seen_auth: init.headers.Authorization ?? null }) });
    const r = await client.publicGet<{ min_version: { ios: string | null }; seen_auth: string | null }>('/mobile/config');
    h.check('§16 a public call returns the answer, and sends no token even when signed in', r.ok && r.value.min_version.ios === '1.0.0' && r.value.seen_auth === null);
    ams.fetch = async () => new Promise<never>(() => {});
    const t0 = Date.now();
    const off = await client.publicGet('/mobile/config');
    h.check('§16 no answer → offline, quickly, and the sign-in is untouched', !off.ok && off.failure.kind === 'offline' && Date.now() - t0 < 1000 && store.data.size === 1 && ended.length === 0);
  }

  // §17 a token for a file transfer (an upload or a download, 7 Nov 2026):
  // renewed when due, exactly as request() would, and the same failure when
  // the renewal is refused
  {
    const { client, ams } = setup();
    await client.signIn(staff);
    const t1 = await client.token();
    h.check('§17 signed in → the current access token', t1.ok && t1.value.startsWith('acc-'));
    const before = ams.count('/mobile/session/refresh');
    ams.clock += 13 * 60_000;
    const t2 = await client.token();
    h.check('§17 when it is due, it is renewed first', t2.ok && t2.value !== (t1.ok ? t1.value : '') && ams.count('/mobile/session/refresh') === before + 1);
    ams.faults.set('/mobile/session/refresh', { status: 401, json: { code: 'SESSION_REVOKED', error: 'Your password was changed. Please sign in again with the new password.' } });
    ams.clock += 13 * 60_000;
    const t3 = await client.token();
    h.check('§17 a refused renewal is that failure, in the AMS\'s words', !t3.ok && t3.failure.kind === 'signed_out' && t3.failure.message.startsWith('Your password was changed'));
  }
  {
    const f = failureOfAnswer(400, { error: 'A valid amount is required' });
    h.check('§17 an upload\'s refusal reads like any other: the AMS\'s words', f.kind === 'refused' && f.message === 'A valid amount is required' && f.status === 400);
    h.check('§17 no answer at all is offline', failureOfAnswer(0, {}).kind === 'offline');
  }
}

runAsync('session.check — the app stays signed in, safely', main);
