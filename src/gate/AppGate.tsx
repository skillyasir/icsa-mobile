import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { ams, DEVICE } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/config';
import { gateFor, type AppConfig } from '@/lib/version';
import { useAppTheme } from '@/theme/useAppTheme';

// The update check (S4, 5 Nov 2026). The AMS says the lowest app version
// allowed on each platform (AMS Settings › Security); below it this screen
// replaces the whole app until it is updated.
//
// Asked on every open and on every return to the app, at most once an hour —
// so a minimum a manager lowers again lets the phone back in by itself. No
// answer keeps whatever the last answer was, and there is no first answer
// until the AMS gives one: the gate FAILS OPEN (lib/version.ts says why).

const RECHECK_MS = 60 * 60_000;

export function AppGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<'ok' | 'update'>('ok');
  const lastAsked = useRef(0);

  useEffect(() => {
    let live = true;
    const ask = async () => {
      if (lastAsked.current && Date.now() - lastAsked.current < RECHECK_MS) return;
      lastAsked.current = Date.now();
      const r = await ams.publicGet<AppConfig>('/mobile/config');
      if (live && r.ok) setGate(gateFor(r.value, DEVICE.platform, DEVICE.appVersion));
    };
    ask();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') ask();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  return gate === 'update' ? <UpdateScreen /> : <>{children}</>;
}

function UpdateScreen() {
  const t = useAppTheme();
  const ios = DEVICE.platform === 'ios';
  const store = ios ? 'the App Store' : 'Google Play';
  const url = ios ? APP_STORE_URL : PLAY_STORE_URL;
  return (
    <View style={[styles.page, { backgroundColor: t.colors.background, padding: t.space.xxl, gap: t.space.lg }]}>
      <AppText variant="title">Please update ICSA</AppText>
      <AppText color="textMuted">
        This version of the app is too old to use. Update it from {store} to carry on — your sign-in is kept.
      </AppText>
      {url ? <Button title={ios ? 'Open the App Store' : 'Open Google Play'} onPress={() => Linking.openURL(url)} /> : null}
      <AppText variant="caption" color="textSubtle">
        This phone has version {DEVICE.appVersion ?? 'unknown'}.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center' },
});
