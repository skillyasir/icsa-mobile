import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { HOME } from '@/navigation/tabs';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

/** The start: sign in, or go to the person's own tabs. */
export default function Start() {
  const { status, user, active, problem, retry, signOut } = useSession();
  const router = useRouter();
  const t = useAppTheme();

  if (status === 'restoring') {
    return (
      <View style={[styles.centre, { backgroundColor: t.colors.background, gap: t.space.md }]}>
        <ActivityIndicator size="large" />
        <AppText color="textMuted">Signing you in…</AppText>
      </View>
    );
  }

  if (status === 'unreachable') {
    // A saved sign-in the AMS could not be asked about. Never a sign-out: the
    // phone keeps it, and the person tries again when the signal is back.
    return (
      <View style={[styles.centre, { backgroundColor: t.colors.background, padding: t.space.xxl, gap: t.space.lg }]}>
        <Notice tone="warning" title="Cannot reach ICSA">
          {problem?.message ?? 'Check your connection and try again.'}
        </Notice>
        <View style={styles.full}>
          <Button title="Try again" onPress={retry} />
        </View>
        <View style={styles.full}>
          <Button
            title="Sign in with another account"
            variant="outline"
            onPress={async () => {
              await signOut();
              router.replace('/sign-in');
            }}
          />
        </View>
      </View>
    );
  }

  if (!user) return <Redirect href="/sign-in" />;
  if (!active) return <Redirect href="/web-only" />;
  return <Redirect href={HOME[active]} />;
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  full: { alignSelf: 'stretch' },
});
