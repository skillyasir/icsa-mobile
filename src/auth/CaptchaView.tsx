import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { AppText } from '@/components/AppText';
import { AMS_WEB_URL } from '@/config';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { captchaLoadDecision, parseCaptchaMessage } from './captchaMessage';

// The Cloudflare check, in a small WebView on the AMS's own page (S1, live
// 4 Nov 2026): Turnstile has no native SDK, and its site key admits
// app.icsasystem.com. The page posts its result back; this view hands the
// token up and can reset the widget after a failed sign-in (a token is
// single-use).
//
// The WebView's own page may only be the AMS page or Cloudflare; Cloudflare's
// inner frames are left alone (captchaLoadDecision says why). A message from
// any page but the AMS's is ignored.
//
// The library's origin list is opened to everything on purpose and the
// decision is made in one place, captchaLoadDecision. That list cannot tell a
// frame from the page: on iOS it is asked about EVERY frame, and anything it
// refuses it also tries to open in Safari. A narrow list there is what left
// the check on "Verifying…" in the first Simulator run (5 Nov 2026).

export const CAPTCHA_URL = `${AMS_WEB_URL}/mobile/captcha.html`;

// react-native-webview 14 types its class as WebView<P = undefined> over
// WebViewProps & P, and under strict TypeScript 6 "& undefined" is never — no
// prop would be accepted. An empty extra-props type gives back WebViewProps.
type NoExtraProps = Record<never, never>;

export type CaptchaHandle = { reset: () => void };

type Props = { onToken: (token: string | null) => void };

type State = 'loading' | 'ready' | 'done' | 'expired' | 'failed';

export const CaptchaView = forwardRef<CaptchaHandle, Props>(function CaptchaView({ onToken }, ref) {
  const t = useAppTheme();
  const web = useRef<WebView<NoExtraProps>>(null);
  const [state, setState] = useState<State>('loading');
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({
    reset() {
      onToken(null);
      setState('ready');
      web.current?.injectJavaScript('window.icsaCaptchaReset && window.icsaCaptchaReset(); true;');
    },
  }));

  const onMessage = (e: WebViewMessageEvent) => {
    const from = e.nativeEvent.url;
    if (from !== CAPTCHA_URL && !from.startsWith(CAPTCHA_URL + '?')) return;
    const m = parseCaptchaMessage(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'ready') setState('ready');
    else if (m.type === 'token') {
      setState('done');
      onToken(m.token);
    } else if (m.type === 'expired' || m.type === 'timeout') {
      setState('expired');
      onToken(null);
    } else {
      setState('failed');
      onToken(null);
    }
  };

  const reload = () => {
    onToken(null);
    setState('loading');
    setAttempt((n) => n + 1);
  };

  return (
    <View style={[styles.box, { borderColor: t.colors.border, backgroundColor: t.colors.surfaceMuted }]}>
      <WebView<NoExtraProps>
        key={`${t.scheme}-${attempt}`}
        ref={web}
        source={{ uri: `${CAPTCHA_URL}?theme=${t.scheme === 'dark' ? 'dark' : 'light'}&v=1` }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r) => captchaLoadDecision(r)}
        onMessage={onMessage}
        onError={() => {
          setState('failed');
          onToken(null);
        }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        style={styles.web}
        accessibilityLabel="Security check"
      />
      {state === 'loading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator />
          <AppText variant="caption" color="textSubtle">
            Loading the security check…
          </AppText>
        </View>
      ) : null}
      {state === 'expired' || state === 'failed' ? (
        <View style={styles.row}>
          <AppText variant="caption" color="textMuted" style={styles.flex}>
            {state === 'expired' ? 'The security check expired.' : 'The security check could not load.'}
          </AppText>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
            <AppText variant="bodyStrong" color="link">
              Try again
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  web: { height: 72, backgroundColor: 'transparent' },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  flex: { flex: 1 },
  retry: { minHeight: minTouch, justifyContent: 'center' },
});
