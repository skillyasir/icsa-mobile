// The app's session with the AMS: sign in, stay signed in, sign out.
// Pure TypeScript — no React Native — so session.check.ts runs it in Node
// against a stand-in AMS. client.ts wires it to the phone (Keychain, device).
//
// How a phone stays signed in (AMS S2, live 4 Nov 2026; Yasir: 30 days, every
// use resets it):
//   - sign in = the AMS's own login (+ the Cloudflare check), then
//     POST /mobile/session, which hands back a REFRESH token bound to this phone.
//   - only the refresh token is kept, in the Keychain / Android Keystore. The
//     ACCESS token lives in memory and is swapped for a new one before it runs
//     out (it lasts the AMS's web session length: idle minutes + 120 s).
//   - every refresh ROTATES the refresh token; the new one is saved at once.
//
// What ends a session, and what never does:
//   - the server saying so (SESSION_INVALID / REVOKED / EXPIRED,
//     ACCOUNT_INACTIVE, AMBIGUOUS_STUDENT) → the phone forgets the token and
//     tells the app, once.
//   - NOT a weak signal, a timeout, a 5xx, a 404 or a 429. Those are reported
//     and the token is kept, so a classroom with bad Wi-Fi never signs anybody
//     out.
//   - Sign out clears the phone FIRST and then tells the server, so it works
//     with no connection at all.

export const REFRESH_TOKEN_KEY = 'icsa.refresh_token';
export const REQUEST_TIMEOUT_MS = 20_000;
/** The app's config is asked on every open: it must never hold the app up for long. */
export const PUBLIC_TIMEOUT_MS = 8_000;
/** Ask for a new access token when less than this is left on the old one. */
export const REFRESH_MARGIN_MS = 60_000;
/** The AMS's token grace on top of the idle minutes (authController TOKEN_GRACE_SECONDS). */
export const TOKEN_GRACE_MS = 120_000;
const DEFAULT_IDLE_MINUTES = 10;

/** Server refusals that mean this phone's session is over. */
export const SESSION_OVER_CODES: ReadonlySet<string> = new Set([
  'SESSION_INVALID',
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'ACCOUNT_INACTIVE',
  'AMBIGUOUS_STUDENT',
]);

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

export type TokenStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export type DeviceInfo = { platform: 'ios' | 'android'; deviceName: string | null; appVersion: string | null };

export type AmsUser = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  branch_id: string | null;
  branch_name: string | null;
  overlay_roles: string[];
  student_code: string | null;
};

export type FailureKind =
  | 'offline' //      no answer: no signal, a timeout
  | 'refused' //      the server said no to THIS attempt (wrong password, check failed…)
  | 'signed_out' //   the phone's session is over; sign in again
  | 'rate_limited'
  | 'server' //       the server answered with a fault
  | 'storage'; //     the phone could not keep the sign-in

export type Failure = { kind: FailureKind; message: string; status?: number; code?: string };
export type Outcome<T> = { ok: true; value: T } | { ok: false; failure: Failure };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T>(failure: Failure): Outcome<T> => ({ ok: false, failure });

export const MESSAGES = {
  offline: 'Cannot reach ICSA. Check your connection and try again.',
  rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
  server: 'The ICSA server had a problem. Please try again.',
  storage: 'This phone could not keep your sign-in. Please try again.',
  signed_out: 'This phone was signed out. Please sign in again.',
} as const;

/** status 0 = no answer at all (no signal, a timeout); json is then empty. */
type Answer = { status: number; json: Record<string, unknown> };

export type SessionDeps = {
  apiUrl: string;
  fetch: FetchLike;
  store: TokenStore;
  device: DeviceInfo;
  now?: () => number;
  timeoutMs?: number;
};

function asUser(raw: unknown): AmsUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.id !== 'string' || typeof u.role !== 'string') return null;
  const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
  return {
    id: u.id,
    full_name: s(u.full_name) ?? '',
    email: s(u.email),
    role: u.role,
    branch_id: s(u.branch_id),
    branch_name: s(u.branch_name),
    overlay_roles: Array.isArray(u.overlay_roles) ? u.overlay_roles.filter((r): r is string => typeof r === 'string') : [],
    student_code: s(u.student_code),
  };
}

const errorText = (json: Record<string, unknown>) => (typeof json.error === 'string' && json.error ? json.error : null);
const codeOf = (json: Record<string, unknown>) => (typeof json.code === 'string' ? json.code : undefined);

/** A server answer that is not a success, as a Failure. `refused` is what a 4xx means for this call. */
/** The same reading of a refusal, for a transfer made outside request() (an upload). */
export function failureOfAnswer(status: number, json: Record<string, unknown>): Failure {
  return failureOf({ status, json }, 'refused');
}

function failureOf(a: Answer, refusedKind: FailureKind): Failure {
  if (a.status === 0) return { kind: 'offline', message: MESSAGES.offline };
  const code = codeOf(a.json);
  const text = errorText(a.json);
  if (a.status === 429) return { kind: 'rate_limited', message: text ?? MESSAGES.rate_limited, status: 429, code };
  if (a.status >= 500 || a.status === 404) return { kind: 'server', message: text ?? MESSAGES.server, status: a.status, code };
  return { kind: refusedKind, message: text ?? MESSAGES.server, status: a.status, code };
}

export class SessionClient {
  private readonly d: Required<Omit<SessionDeps, 'now' | 'timeoutMs'>> & { now: () => number; timeoutMs: number };
  private access: { token: string; expiresAt: number } | null = null;
  private refreshing: Promise<Outcome<null>> | null = null;
  /** Bumped by sign-in and sign-out; a refresh that started in another epoch is thrown away. */
  private epoch = 0;
  private ended: ((f: Failure) => void) | null = null;

  constructor(deps: SessionDeps) {
    this.d = { ...deps, now: deps.now ?? Date.now, timeoutMs: deps.timeoutMs ?? REQUEST_TIMEOUT_MS };
  }

  /** Called once each time the SERVER ends this phone's session. */
  onSessionEnded(fn: ((f: Failure) => void) | null): void {
    this.ended = fn;
  }

  // ---------------------------------------------------------------------------
  // The wire. Every call goes through here: one timeout, one JSON rule.
  private async call(method: string, path: string, body?: unknown, bearer?: string, timeoutMs = this.d.timeoutMs): Promise<Answer> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        ac?.abort();
        resolve('timeout');
      }, timeoutMs);
    });
    try {
      const res = await Promise.race([
        this.d.fetch(this.d.apiUrl + path, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: ac?.signal,
        }),
        timeout,
      ]);
      if (res === 'timeout') return { status: 0, json: {} };
      const raw = await res.text();
      let json: Record<string, unknown> = {};
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) json = parsed as Record<string, unknown>;
      } catch {
        // an HTML error page from a proxy: keep the status, no body
      }
      return { status: res.status, json };
    } catch {
      return { status: 0, json: {} };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private keepAccess(json: Record<string, unknown>): boolean {
    if (typeof json.token !== 'string' || !json.token) return false;
    const session = (json.session ?? {}) as Record<string, unknown>;
    const idle = typeof session.idleMinutes === 'number' && session.idleMinutes > 0 ? session.idleMinutes : DEFAULT_IDLE_MINUTES;
    this.access = { token: json.token, expiresAt: this.d.now() + idle * 60_000 + TOKEN_GRACE_MS };
    return true;
  }

  private async forget(): Promise<void> {
    this.access = null;
    try {
      await this.d.store.remove(REFRESH_TOKEN_KEY);
    } catch {
      // nothing more can be done; the server refuses this token anyway
    }
  }

  // ---------------------------------------------------------------------------
  /** Sign in with the AMS account, then bind a session to this phone. */
  async signIn(route: { path: string; body: Record<string, string> }): Promise<Outcome<AmsUser>> {
    this.epoch++;
    this.access = null;
    const login = await this.call('POST', route.path, route.body);
    if (login.status !== 200) return fail(failureOf(login, 'refused'));
    const user = asUser(login.json.user);
    const accessToken = typeof login.json.token === 'string' ? login.json.token : null;
    if (!user || !accessToken) return fail({ kind: 'server', message: MESSAGES.server, status: 200 });

    const { platform, deviceName, appVersion } = this.d.device;
    const bind = await this.call(
      'POST',
      '/mobile/session',
      { platform, device_name: deviceName ?? undefined, app_version: appVersion ?? undefined },
      accessToken,
    );
    if (bind.status !== 201) return fail(failureOf(bind, 'refused'));
    const refreshToken = typeof bind.json.refresh_token === 'string' ? bind.json.refresh_token : null;
    if (!refreshToken) return fail({ kind: 'server', message: MESSAGES.server, status: bind.status });

    try {
      await this.d.store.set(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // A session the phone cannot keep is one nobody should be able to use.
      await this.call('POST', '/mobile/session/signout', { refresh_token: refreshToken });
      return fail({ kind: 'storage', message: MESSAGES.storage });
    }
    this.keepAccess(login.json);
    return ok(user);
  }

  /** On launch: is this phone still signed in? null = no saved sign-in. */
  async restore(): Promise<Outcome<AmsUser | null>> {
    let saved: string | null;
    try {
      saved = await this.d.store.get(REFRESH_TOKEN_KEY);
    } catch {
      return fail({ kind: 'storage', message: MESSAGES.storage });
    }
    if (!saved) return ok(null);
    const r = await this.refresh();
    if (!r.ok) return fail(r.failure);
    const me = await this.request<{ user?: unknown }>('GET', '/auth/me');
    if (!me.ok) return fail(me.failure);
    const user = asUser(me.value.user);
    return user ? ok(user) : fail({ kind: 'server', message: MESSAGES.server });
  }

  /** Swap the saved refresh token for a new access token. One at a time. */
  refresh(): Promise<Outcome<null>> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<Outcome<null>> {
    const started = this.epoch;
    let saved: string | null;
    try {
      saved = await this.d.store.get(REFRESH_TOKEN_KEY);
    } catch {
      return fail({ kind: 'storage', message: MESSAGES.storage });
    }
    if (!saved) {
      this.access = null;
      return fail({ kind: 'signed_out', message: MESSAGES.signed_out });
    }
    const a = await this.call('POST', '/mobile/session/refresh', {
      refresh_token: saved,
      app_version: this.d.device.appVersion ?? undefined,
    });

    if (this.epoch !== started) {
      // Signed out (or in again) while this was on the wire. Do not bring the
      // old session back; tell the server to end the token it just issued.
      if (a.status === 200 && typeof a.json.refresh_token === 'string') {
        await this.call('POST', '/mobile/session/signout', { refresh_token: a.json.refresh_token });
      }
      return fail({ kind: 'signed_out', message: MESSAGES.signed_out });
    }

    if (a.status === 200 && typeof a.json.refresh_token === 'string' && typeof a.json.token === 'string') {
      try {
        await this.d.store.set(REFRESH_TOKEN_KEY, a.json.refresh_token);
      } catch {
        // The server has rotated; the old token still answers for two minutes.
        // Use this access token for now and say so.
        this.keepAccess(a.json);
        return fail({ kind: 'storage', message: MESSAGES.storage });
      }
      this.keepAccess(a.json);
      return ok(null);
    }

    const code = a.status === 0 ? undefined : codeOf(a.json);
    const over = a.status === 401 || (a.status === 409 && code === 'AMBIGUOUS_STUDENT') || (code !== undefined && SESSION_OVER_CODES.has(code));
    if (a.status !== 0 && over) {
      await this.forget();
      const f: Failure = { kind: 'signed_out', message: errorText(a.json) ?? MESSAGES.signed_out, status: a.status, code };
      this.ended?.(f);
      return fail(f);
    }
    return fail(failureOf(a, 'server'));
  }

  /** An AMS call as the signed-in person. Refreshes first if the token is nearly out. */
  async request<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<Outcome<T>> {
    if (!this.access || this.access.expiresAt - this.d.now() < REFRESH_MARGIN_MS) {
      const r = await this.refresh();
      if (!r.ok) return fail(r.failure);
    }
    let a = await this.call(method, path, body, this.access?.token);
    if (a.status === 401) {
      // The token was refused early (deactivated, rotated elsewhere): one fresh
      // token and one retry. Never a loop.
      const r = await this.refresh();
      if (!r.ok) return fail(r.failure);
      a = await this.call(method, path, body, this.access?.token);
    }
    if (a.status >= 200 && a.status < 300) return ok(a.json as T);
    return fail(failureOf(a, 'refused'));
  }

  /**
   * A current access token, for a transfer the JSON wire cannot carry — a file
   * upload (multipart) or download. Renewed first when due, exactly as
   * request() does; a refused renewal is the same failure.
   */
  async token(): Promise<Outcome<string>> {
    if (!this.access || this.access.expiresAt - this.d.now() < REFRESH_MARGIN_MS) {
      const r = await this.refresh();
      if (!r.ok) return fail(r.failure);
    }
    return this.access ? ok(this.access.token) : fail({ kind: 'signed_out', message: MESSAGES.signed_out });
  }

  /** An AMS call that needs no sign-in (the app's config, S4). Never sends a token. */
  async publicGet<T = Record<string, unknown>>(path: string): Promise<Outcome<T>> {
    const a = await this.call('GET', path, undefined, undefined, Math.min(PUBLIC_TIMEOUT_MS, this.d.timeoutMs));
    if (a.status >= 200 && a.status < 300) return ok(a.json as T);
    return fail(failureOf(a, 'server'));
  }

  /** Forget this phone's sign-in, then tell the server. Works offline. */
  async signOut(): Promise<void> {
    this.epoch++;
    let saved: string | null = null;
    try {
      saved = await this.d.store.get(REFRESH_TOKEN_KEY);
    } catch {
      saved = null;
    }
    await this.forget();
    if (saved) await this.call('POST', '/mobile/session/signout', { refresh_token: saved });
  }

  /** For screens that need to know, without asking the server. */
  get hasAccessToken(): boolean {
    return this.access !== null;
  }
}
