import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ams } from '@/api/client';
import type { AmsUser, Failure, Outcome } from '@/api/session';
import { appleToken, googleToken } from '@/auth/nativeSignIn';
import { providerRoute, type Provider } from '@/auth/providerRoute';
import { signInRoute } from '@/auth/signInRoute';
import { experiencesFor, type Experience } from '@/lib/roles';

// Who is signed in, and which experience they are looking at.
//
// PIECE 4 (6 Nov 2026): Google and Sign in with Apple (S12) — the provider's
// token goes to the AMS, which answers as the password sign-in does.
// PIECE 2 (4 Nov 2026): real sign-in. The AMS login + the Cloudflare check,
// then a device session (AMS S2) so the phone stays signed in for 30 days of
// not being used (Yasir). The developer preview stays, in development builds
// only (__DEV__).
//
//   restoring    launch: asking the AMS whether this phone is still signed in
//   unreachable  there is a saved sign-in but the AMS could not be asked
//                (no signal, a server fault). It is KEPT; the person retries.
//   signedOut    no sign-in on this phone, or the AMS ended it
//   signedIn

export type SessionUser = {
  full_name: string;
  role: string;
  overlay_roles: string[];
  email?: string | null;
  branch_name?: string | null;
  student_code?: string | null;
  /** True for the developer preview: made-up person, no AMS account behind it. */
  preview: boolean;
};

export type SessionStatus = 'restoring' | 'unreachable' | 'signedOut' | 'signedIn';

type Session = {
  status: SessionStatus;
  user: SessionUser | null;
  /** Why the person is on the sign-in screen, when the AMS said so. */
  notice: string | null;
  /** What went wrong while restoring, when status is 'unreachable'. */
  problem: Failure | null;
  experiences: Experience[];
  active: Experience | null;
  setActive: (e: Experience) => void;
  signIn: (identifier: string, password: string, captchaToken: string) => Promise<Outcome<AmsUser>>;
  /** Google or Apple (S12). null = the person closed Google's or Apple's sheet. */
  signInWith: (provider: Provider) => Promise<Outcome<AmsUser> | null>;
  retry: () => void;
  previewSignIn: (user: Omit<SessionUser, 'preview'>) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

const fromAms = (u: AmsUser): SessionUser => ({
  full_name: u.full_name,
  role: u.role,
  overlay_roles: u.overlay_roles,
  email: u.email,
  branch_name: u.branch_name,
  student_code: u.student_code,
  preview: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [chosen, setChosen] = useState<Experience | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<Failure | null>(null);

  // What the AMS said about a saved sign-in.
  const settle = useCallback((r: Outcome<AmsUser | null>) => {
    if (r.ok && r.value) {
      setUser(fromAms(r.value));
      setStatus('signedIn');
    } else if (r.ok) {
      setStatus('signedOut');
    } else if (r.failure.kind === 'signed_out') {
      setNotice(r.failure.message);
      setStatus('signedOut');
    } else {
      setProblem(r.failure);
      setStatus('unreachable');
    }
  }, []);

  useEffect(() => {
    // The AMS ended this phone's session while it was in use.
    ams.onSessionEnded((f) => {
      setUser(null);
      setChosen(null);
      setNotice(f.message);
      setStatus('signedOut');
    });
    let live = true;
    ams.restore().then((r) => {
      if (live) settle(r);
    });
    return () => {
      live = false;
      ams.onSessionEnded(null);
    };
  }, [settle]);

  const retry = useCallback(() => {
    setStatus('restoring');
    setProblem(null);
    ams.restore().then(settle);
  }, [settle]);

  // Every sign-in ends here, whichever way the person proved who they are.
  const signedIn = useCallback((r: Outcome<AmsUser>) => {
    if (r.ok) {
      setUser(fromAms(r.value));
      setChosen(null);
      setNotice(null);
      setProblem(null);
      setStatus('signedIn');
    }
    return r;
  }, []);

  const signIn = useCallback(async (identifier: string, password: string, captchaToken: string) => {
    const route = signInRoute(identifier);
    return signedIn(await ams.signIn({ path: route.path, body: route.body(password, captchaToken) }));
  }, [signedIn]);

  const signInWith = useCallback(async (provider: Provider): Promise<Outcome<AmsUser> | null> => {
    const got = provider === 'google' ? await googleToken() : await appleToken();
    if (!got.ok) return got.cancelled ? null : { ok: false, failure: { kind: 'refused', message: got.message } };
    return signedIn(await ams.signIn(providerRoute(provider, got.token)));
  }, [signedIn]);

  const previewSignIn = useCallback((u: Omit<SessionUser, 'preview'>) => {
    if (!__DEV__) return; // never reachable in a store build
    setUser({ ...u, preview: true });
    setChosen(null);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setChosen(null);
    setNotice(null);
    setProblem(null);
    setStatus('signedOut');
    await ams.signOut();
  }, []);

  const experiences = useMemo(() => (user ? experiencesFor(user) : []), [user]);
  const active = chosen && experiences.includes(chosen) ? chosen : (experiences[0] ?? null);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      notice,
      problem,
      experiences,
      active,
      setActive: setChosen,
      signIn,
      signInWith,
      retry,
      previewSignIn,
      signOut,
    }),
    [status, user, notice, problem, experiences, active, signIn, signInWith, retry, previewSignIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession() outside <SessionProvider>');
  return s;
}
