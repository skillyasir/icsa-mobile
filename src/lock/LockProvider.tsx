import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { phoneStore } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import { lockAbility, lockWanted, shouldLock, type LockAbility } from './lockRule';

// The Face ID / fingerprint lock (S4, Yasir 5 Nov 2026). The rule is
// lockRule.ts; this file is the phone side of it.
//
//   - when the app goes to the background, the time is kept (on the phone, in
//     the Keychain) and the screen is covered, so the app switcher shows the
//     ICSA cover and nobody's data;
//   - when it comes back, or opens fresh with a saved sign-in, lockRule says
//     whether to lock;
//   - unlocking is the phone's own prompt: Face ID or the fingerprint, then the
//     phone's passcode; "Sign in again" is there for anyone who cannot.
//
// A fresh sign-in counts as use, so it never locks straight after.

const WANTED_KEY = 'icsa.lock';

/**
 * What this phone can unlock with, asked fresh. Asked on every return to the
 * app, not only at launch: someone told "set up a passcode in Settings" does
 * exactly that with ICSA still open, and the first Android run (5 Nov 2026)
 * never locked because the answer read at launch — no lock at all — was kept.
 */
async function readAbility(platform: 'ios' | 'android'): Promise<LockAbility> {
  const [types, level] = await Promise.all([
    LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
    LocalAuthentication.getEnrolledLevelAsync().catch(() => 0),
  ]);
  return lockAbility(platform, types, level);
}
const LAST_ACTIVE_KEY = 'icsa.last_active';

type Lock = {
  ability: LockAbility;
  wanted: boolean;
  /** Turning it ON asks the phone first, so nobody switches on a lock they cannot open. */
  setWanted: (on: boolean, opts?: { confirm?: boolean }) => Promise<boolean>;
};

const LockContext = createContext<Lock | null>(null);

const save = async (key: string, value: string | null) => {
  try {
    if (value === null) await phoneStore.remove(key);
    else await phoneStore.set(key, value);
  } catch {
    // The lock still works for this run; only the memory of it across launches is lost.
  }
};

export function LockProvider({ children }: { children: ReactNode }) {
  const { status, user, signOut } = useSession();
  const t = useAppTheme();
  const platform = Platform.OS === 'android' ? 'android' : 'ios';

  const [ability, setAbility] = useState<LockAbility>({ available: false, method: platform === 'ios' ? 'Face ID' : 'fingerprint' });
  const [wanted, setWantedState] = useState(true);
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastActive = useRef<number | null>(null);
  const previousStatus = useRef(status);
  const beenAway = useRef(false);
  const prompting = useRef(false);

  const signedIn = status === 'signedIn' && !!user;
  const preview = !!user?.preview;
  // The latest facts, for the app-state listener (set after each render).
  const facts = useRef({ wanted, available: ability.available, signedIn, preview });
  useEffect(() => {
    facts.current = { wanted, available: ability.available, signedIn, preview };
  });

  // What this phone can do, what the person chose, and when it was last used.
  useEffect(() => {
    let live = true;
    (async () => {
      const [found, saved, last] = await Promise.all([
        readAbility(platform),
        phoneStore.get(WANTED_KEY).catch(() => null),
        phoneStore.get(LAST_ACTIVE_KEY).catch(() => null),
      ]);
      if (!live) return;
      setAbility(found);
      setWantedState(lockWanted(saved));
      const n = last === null ? NaN : Number(last);
      lastActive.current = Number.isFinite(n) ? n : null;
      setReady(true);
    })();
    return () => {
      live = false;
    };
  }, [platform]);

  const markActive = useCallback(() => {
    lastActive.current = Date.now();
    save(LAST_ACTIVE_KEY, String(lastActive.current));
  }, []);

  // The phone's own prompt. Every state change waits for its answer, and
  // there is never a second prompt over the first.
  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ICSA',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false, // the phone's passcode when Face ID / the fingerprint fails (Yasir)
    }).catch(() => ({ success: false as const }));
    prompting.current = false;
    setFailed(!r.success);
    if (r.success) {
      markActive();
      setLocked(false);
    }
  }, [markActive]);

  // Lock, and ask at once; the buttons stay for a second try.
  const lockAndAsk = useCallback(() => {
    setLocked(true);
    unlock();
  }, [unlock]);

  // A launch that restored a saved sign-in may need the lock; a fresh sign-in
  // is use. Signing out clears it all, so the next person starts from the
  // default (on).
  useEffect(() => {
    if (!ready) return;
    const was = previousStatus.current;
    previousStatus.current = status;
    if (status === 'signedIn' && was === 'restoring') {
      const f = facts.current;
      if (shouldLock({ ...f, lastActiveAt: lastActive.current, now: Date.now() })) lockAndAsk();
      else markActive();
    } else if (status === 'signedIn' && was !== 'signedIn') {
      markActive();
    } else if (status === 'signedOut' && was === 'signedIn') {
      setLocked(false);
      setCovered(false);
      lastActive.current = null;
      save(LAST_ACTIVE_KEY, null);
      save(WANTED_KEY, null);
      setWantedState(true);
    }
  }, [status, ready, markActive, lockAndAsk]);

  // Away and back. Only a return after the app has been in the BACKGROUND is
  // "back": on iOS the Face ID prompt itself makes the app inactive and then
  // active, and treating that as a return would lock and ask again for ever —
  // Cancel would never reach "Sign in again".
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const f = facts.current;
      const lockable = f.wanted && f.available && f.signedIn && !f.preview;
      if (s === 'background') {
        beenAway.current = true;
        if (f.signedIn) markActive();
        if (lockable) setCovered(true);
      } else if (s === 'inactive') {
        // iOS photographs the screen for the app switcher here: cover it.
        if (lockable) setCovered(true);
      } else if (s === 'active') {
        const back = beenAway.current;
        beenAway.current = false;
        // Ask the phone again before deciding, and keep the cover on until
        // the decision is made, so nothing shows for a frame before the lock.
        readAbility(platform).then((found) => {
          setAbility(found);
          const now = facts.current;
          const lockableNow = now.wanted && found.available && now.signedIn && !now.preview;
          if (back && lockableNow && shouldLock({ ...now, available: found.available, lastActiveAt: lastActive.current, now: Date.now() })) lockAndAsk();
          setCovered(false);
        });
      }
    });
    return () => sub.remove();
  }, [markActive, lockAndAsk, platform]);

  const setWanted = useCallback(
    async (on: boolean, opts: { confirm?: boolean } = {}) => {
      if (on && opts.confirm !== false) {
        const r = await LocalAuthentication.authenticateAsync({ promptMessage: `Turn on ${ability.method}`, disableDeviceFallback: false });
        if (!r.success) return false;
      }
      setWantedState(on);
      await save(WANTED_KEY, on ? 'on' : 'off');
      if (on) markActive();
      return true;
    },
    [ability.method, markActive],
  );

  const value = useMemo<Lock>(() => ({ ability, wanted, setWanted }), [ability, wanted, setWanted]);
  const hide = locked || covered;

  return (
    <LockContext.Provider value={value}>
      <View
        style={styles.fill}
        importantForAccessibility={hide ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={hide}
      >
        {children}
      </View>
      {hide ? (
        <View style={[styles.cover, { backgroundColor: t.colors.background, padding: t.space.xxl, gap: t.space.lg }]}>
          <View style={[styles.logo, { backgroundColor: t.colors.hero }]}>
            <AppText variant="headline" color="onHero">
              ICSA
            </AppText>
          </View>
          {locked ? (
            <>
              <AppText variant="title">ICSA is locked</AppText>
              <AppText color="textMuted" style={styles.centred}>
                {failed ? `${ability.method} did not unlock it. Try again, or sign in with your ICSA password.` : `Unlock with ${ability.method}.`}
              </AppText>
              <View style={styles.full}>
                <Button title={`Unlock with ${ability.method}`} onPress={unlock} />
              </View>
              <View style={styles.full}>
                <Button
                  title="Sign in again"
                  variant="outline"
                  onPress={async () => {
                    setLocked(false);
                    await signOut();
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </LockContext.Provider>
  );
}

export function useLock(): Lock {
  const l = useContext(LockContext);
  if (!l) throw new Error('useLock() outside <LockProvider>');
  return l;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Over everything, edge to edge (RN 0.88 has no absoluteFillObject).
  cover: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  centred: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
});
