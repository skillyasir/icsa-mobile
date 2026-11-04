import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { experiencesFor, type Experience } from '@/lib/roles';

// Who is signed in, and which experience they are looking at.
//
// PIECE 1 (4 Nov 2026): there is no real sign-in yet. The only way in is the
// developer preview on the sign-in screen, which exists in development builds
// alone (__DEV__). Real sign-in — the AMS login, the captcha, device sessions
// and tokens in the Keychain — replaces previewSignIn in the next pieces.

export type SessionUser = {
  full_name: string;
  role: string;
  overlay_roles: string[];
  /** True for the developer preview: made-up person, no AMS account behind it. */
  preview: boolean;
};

type Session = {
  user: SessionUser | null;
  experiences: Experience[];
  active: Experience | null;
  setActive: (e: Experience) => void;
  previewSignIn: (user: Omit<SessionUser, 'preview'>) => void;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [chosen, setChosen] = useState<Experience | null>(null);

  const experiences = useMemo(() => (user ? experiencesFor(user) : []), [user]);
  const active = chosen && experiences.includes(chosen) ? chosen : (experiences[0] ?? null);

  const previewSignIn = useCallback((u: Omit<SessionUser, 'preview'>) => {
    if (!__DEV__) return; // never reachable in a store build
    setUser({ ...u, preview: true });
    setChosen(null);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setChosen(null);
  }, []);

  const value = useMemo<Session>(
    () => ({ user, experiences, active, setActive: setChosen, previewSignIn, signOut }),
    [user, experiences, active, previewSignIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession() outside <SessionProvider>');
  return s;
}
