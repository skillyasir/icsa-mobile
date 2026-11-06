import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ams } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Card } from '@/components/Screen';
import { appleAvailable, appleToken } from '@/auth/nativeSignIn';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// Me › SIGN-IN (S12, 6 Nov 2026). Yasir: an Apple email that matches no ICSA
// account (Apple can hide it) is linked here, once, while signed in; the Apple
// button on the sign-in screen works for them from then on. Google needs no
// link: it signs in the Google account whose email is the ICSA email.
//
// The AMS is the answer: the switch shows what GET /auth/apple says, and turns
// only after the AMS has linked or unlinked.

type AppleState = { linked: boolean } | null; // null = not known yet

export function SignInMethods({ email }: { email: string | null | undefined }) {
  const t = useAppTheme();
  const [apple, setApple] = useState(false);
  const [state, setState] = useState<AppleState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    appleAvailable().then(async (yes) => {
      if (!live || !yes) return;
      setApple(true);
      const r = await ams.request<{ linked?: unknown }>('GET', '/auth/apple');
      if (live) setState(r.ok ? { linked: r.value.linked === true } : null);
      if (live && !r.ok) setError(r.failure.message);
    });
    return () => {
      live = false;
    };
  }, []);

  const turn = async (on: boolean) => {
    setBusy(true);
    setError(null);
    if (on) {
      const got = await appleToken();
      if (!got.ok) {
        setBusy(false);
        if (!got.cancelled) setError(got.message);
        return;
      }
      const r = await ams.request<{ linked?: unknown }>('POST', '/auth/apple/link', { identity_token: got.token });
      if (r.ok) setState({ linked: r.value.linked === true });
      else setError(r.failure.message);
    } else {
      const r = await ams.request<{ linked?: unknown }>('POST', '/auth/apple/unlink');
      if (r.ok) setState({ linked: r.value.linked === true });
      else setError(r.failure.message);
    }
    setBusy(false);
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <AppText variant="label" color="textMuted">
        SIGN-IN
      </AppText>
      <Card>
        {apple ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="body">Sign in with Apple</AppText>
              <AppText variant="caption" color="textSubtle">
                {state === null
                  ? 'Checking…'
                  : state.linked
                    ? 'On — the Apple button signs you in to this ICSA account.'
                    : 'Turn on to sign in with your Apple ID next time.'}
              </AppText>
            </View>
            <Switch
              value={state?.linked === true}
              disabled={state === null || busy}
              onValueChange={turn}
              accessibilityLabel="Sign in with Apple"
            />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="body">Sign in with Google</AppText>
            <AppText variant="caption" color="textSubtle">
              {email
                ? `Works with the Google account whose email is ${email}.`
                : 'Works with the Google account whose email is your ICSA email.'}
            </AppText>
          </View>
        </View>
      </Card>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
