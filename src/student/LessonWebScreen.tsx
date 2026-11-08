import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { ams } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  RELOAD_AT_MOST_EVERY_MS,
  TOKEN_PUSH_EVERY_MS,
  bootScript,
  pageLoadDecision,
  pageMessage,
  pageUser,
  subjectPageUrl,
  tokenScript,
} from './webPage';

// A lesson or a quiz, as the website's own page (Yasir ruled, 8 Nov 2026).
// The app's header goes back; the page under it is the AMS subject page in
// app mode, opened on the item the student tapped, signed in with the app's
// own short-lived token (webPage.ts says how, and what the page may do).

// react-native-webview 14 types its class as WebView<P = undefined> over
// WebViewProps & P; an empty extra-props type gives back WebViewProps
// (CaptchaView.tsx, 5 Nov 2026).
type NoExtraProps = Record<never, never>;

export function LessonWebScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const { subject, item, title } = useLocalSearchParams<{ subject?: string; item?: string; title?: string }>();
  const web = useRef<WebView<NoExtraProps>>(null);
  const [boot, setBoot] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [generation, setGeneration] = useState(0);
  const lastReload = useRef(0);

  // The sign-in the page starts with — fresh, every time it (re)loads.
  const [asked, setAsked] = useState(0);
  const start = useCallback(() => setAsked((n) => n + 1), []);

  useEffect(() => {
    if (!user || user.preview) return;
    let alive = true;
    ams.token().then((tok) => {
      if (!alive) return;
      if (!tok.ok) {
        setFailure(tok.failure.message);
        return;
      }
      setFailure(null);
      setBoot(bootScript(tok.value, pageUser(user)));
      setGeneration((g) => g + 1);
    });
    return () => {
      alive = false;
    };
  }, [user, asked]);

  // While it is open, a fresh sign-in every minute, read by the page's next request.
  useEffect(() => {
    if (!boot) return;
    const timer = setInterval(async () => {
      const tok = await ams.token();
      if (tok.ok) web.current?.injectJavaScript(tokenScript(tok.value));
    }, TOKEN_PUSH_EVERY_MS);
    return () => clearInterval(timer);
  }, [boot]);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = pageMessage(e.nativeEvent.data, e.nativeEvent.url);
    if (m !== 'auth-expired') return;
    // The page's sign-in ran out (the phone slept, say): reload with a fresh one — not in a loop.
    const now = Date.now();
    if (now - lastReload.current < RELOAD_AT_MOST_EVERY_MS) {
      setFailure('The lesson could not stay signed in. Go back and open it again.');
      return;
    }
    lastReload.current = now;
    setLoading(true);
    start();
  };

  const back = () => {
    if (canGoBack) web.current?.goBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/student/learn');
  };

  if (user?.preview) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: t.colors.background, padding: t.space.lg }]}>
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there is no lesson to open.
        </Notice>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: t.colors.background }]}>
      <View style={[styles.bar, { borderBottomColor: t.colors.border, backgroundColor: t.colors.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} onPress={back} style={styles.back}>
          <AppText variant="bodyStrong" color="link">
            ‹ Back
          </AppText>
        </Pressable>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {title ?? ''}
        </AppText>
        {loading ? <ActivityIndicator /> : null}
      </View>
      {failure ? (
        <View style={{ padding: t.space.lg, gap: t.space.md }}>
          <Notice tone="danger">{failure}</Notice>
          <Button title="Try again" variant="outline" onPress={start} />
        </View>
      ) : null}
      {!subject ? (
        <View style={{ padding: t.space.lg }}>
          <Notice tone="danger">This lesson could not be found.</Notice>
        </View>
      ) : boot ? (
        <WebView<NoExtraProps>
          key={generation}
          ref={web}
          source={{ uri: subjectPageUrl(subject, item ?? null) }}
          injectedJavaScriptBeforeContentLoaded={boot}
          injectedJavaScriptBeforeContentLoadedForMainFrameOnly
          incognito
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled
          allowsInlineMediaPlayback
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(r) => {
            const d = pageLoadDecision(r);
            if (d === 'outside') Linking.openURL(r.url).catch(() => undefined);
            return d === 'load';
          }}
          onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailure('The lesson could not load. Check your connection and try again.');
          }}
          onMessage={onMessage}
          style={[styles.flex, { backgroundColor: t.colors.background }]}
        />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { minHeight: minTouch, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
