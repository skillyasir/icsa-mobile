import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CaptchaView, type CaptchaHandle } from '@/auth/CaptchaView';
import { appleAvailable } from '@/auth/nativeSignIn';
import type { Provider } from '@/auth/providerRoute';
import { useLayout } from '@/layout/useLayout';
import { useLock } from '@/lock/LockProvider';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { FORGOT_PASSWORD_URL } from '@/config';
import { useSession, type SessionUser } from '@/session/SessionContext';
import { brand, minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// Mockup 16, approved 3 Nov 2026. PIECE 2 (4 Nov 2026): Sign in is real — the
// AMS login with the Cloudflare check (S1), then a device session (S2) so the
// phone stays signed in. Which AMS endpoint is asked is the web login's own
// rule (auth/signInRoute.ts). The "Unlock with Face ID" switch came back with
// the lock itself (S4, 5 Nov 2026), and shows only on a phone that can lock.
// PIECE 4 (6 Nov 2026): Sign in with Apple (iPhone) and Google (both) are real
// (S12). 9 Nov 2026 (Yasir): logos only — the worded buttons were cut off
// side by side on a phone with big text. Google's is Google's own icon button;
// Apple's is Apple's logo on Apple's black or white, the same size, beside it
// (App Review 4.8: at least as prominent).

// Developer preview: made-up people, one per experience, plus mixed roles.
// Shown in development builds only (__DEV__) — never in a store build.
const PREVIEW: { label: string; user: Omit<SessionUser, 'preview'> }[] = [
  { label: 'Student', user: { full_name: 'Maria Santos', role: 'student', overlay_roles: [] } },
  { label: 'Teacher', user: { full_name: 'Sara Khan', role: 'teacher', overlay_roles: [] } },
  { label: 'Reception', user: { full_name: 'Fatima Noor', role: 'supervisor', overlay_roles: [] } },
  { label: 'Marketer', user: { full_name: 'Layla Hassan', role: 'marketer', overlay_roles: [] } },
  { label: 'Manager', user: { full_name: 'Yousef Karim', role: 'manager', overlay_roles: [] } },
  { label: 'Manager + Teacher', user: { full_name: 'Yousef Karim', role: 'manager', overlay_roles: ['teacher'] } },
  { label: 'Reception + Marketer', user: { full_name: 'Aisha Rahman', role: 'supervisor', overlay_roles: ['marketer'] } },
  { label: 'Accountant (web only)', user: { full_name: 'Hana Ali', role: 'accountant', overlay_roles: [] } },
];

export default function SignIn() {
  const t = useAppTheme();
  // iPad (10 Nov 2026): the form is a centred column, never stretched across the screen.
  const { wide } = useLayout();
  const router = useRouter();
  const { previewSignIn, signIn, signInWith, notice } = useSession();
  const lock = useLock();
  const [lockOn, setLockOn] = useState(true);
  const captcha = useRef<CaptchaHandle>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [busyWith, setBusyWith] = useState<'password' | Provider | null>(null);
  const busy = busyWith !== null;
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    let live = true;
    appleAvailable().then((yes) => {
      if (live) setApple(yes);
    });
    return () => {
      live = false;
    };
  }, []);

  const ready = identifier.trim() !== '' && password !== '' && captchaToken !== null && !busy;

  const done = async () => {
    // The person's choice, without a second prompt: the lock asks the next time.
    if (lock.ability.available) await lock.setWanted(lockOn, { confirm: false });
    setPassword('');
    router.replace('/');
  };

  const submit = async () => {
    if (!ready || !captchaToken) return;
    setBusyWith('password');
    setMessage(null);
    const r = await signIn(identifier, password, captchaToken);
    setBusyWith(null);
    if (r.ok) return done();
    // A check token is single-use: every failed attempt needs a fresh one.
    captcha.current?.reset();
    setMessage({ tone: 'danger', text: r.failure.message });
  };

  const withProvider = async (provider: Provider) => {
    if (busy) return;
    setBusyWith(provider);
    setMessage(null);
    const r = await signInWith(provider);
    setBusyWith(null);
    if (!r) return; // closed Google's or Apple's sheet: nothing to say
    if (r.ok) return done();
    setMessage({ tone: 'danger', text: r.failure.message });
  };

  return (
    <View style={[styles.fill, { backgroundColor: t.colors.surface }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.hero, { backgroundColor: t.colors.hero }]}>
            <View
              style={styles.decor}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View style={styles.ring} />
              <View style={[styles.dot, styles.dotYellow]} />
              <View style={[styles.dot, styles.dotGreen]} />
            </View>
            <SafeAreaView edges={['top']} style={[styles.heroInner, wide && styles.narrow]}>
              <View style={styles.logoTile}>
                <AppText variant="headline" style={styles.logoText}>
                  ICSA
                </AppText>
              </View>
              <AppText variant="largeTitle" color="onHero" accessibilityRole="header">
                Welcome to ICSA
              </AppText>
              <AppText color="onHeroMuted">Staff and students sign in with their ICSA account</AppText>
            </SafeAreaView>
          </View>

          <View style={[styles.form, { padding: t.space.xxl, gap: t.space.lg }, wide && styles.narrow]}>
            <TextField
              label="Username, email or student code"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(FORGOT_PASSWORD_URL)}
              style={styles.forgot}
            >
              <AppText variant="bodyStrong" color="link">
                Forgot password?
              </AppText>
            </Pressable>

            <CaptchaView ref={captcha} onToken={setCaptchaToken} />

            {notice && !message ? <Notice tone="warning">{notice}</Notice> : null}
            {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

            <Button title="Sign in" onPress={submit} disabled={!ready} busy={busyWith === 'password'} />

            <View style={styles.orRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.rule, { backgroundColor: t.colors.border }]} />
              <AppText variant="caption" color="textSubtle">
                or
              </AppText>
              <View style={[styles.rule, { backgroundColor: t.colors.border }]} />
            </View>

            <View style={styles.social}>
              {apple ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Apple"
                  disabled={busy}
                  onPress={() => withProvider('apple')}
                  style={({ pressed }) => [
                    styles.logoButton,
                    { backgroundColor: t.colors.appleButton, borderRadius: SOCIAL_RADIUS },
                    (busy || pressed) && styles.dim,
                  ]}
                >
                  <SymbolView name="apple.logo" size={22} tintColor={t.colors.onAppleButton} />
                </Pressable>
              ) : null}
              <View style={[styles.logoButton, busy && styles.dim]}>
                <GoogleSigninButton
                  size={GoogleSigninButton.Size.Icon}
                  color={t.scheme}
                  accessibilityLabel="Sign in with Google"
                  disabled={busy}
                  onPress={() => withProvider('google')}
                  style={styles.logoButton}
                />
              </View>
            </View>
            {busyWith === 'apple' || busyWith === 'google' ? (
              <AppText variant="caption" color="textSubtle" style={styles.centred}>
                Signing in with {busyWith === 'apple' ? 'Apple' : 'Google'}…
              </AppText>
            ) : null}

            {lock.ability.available ? (
              <View style={styles.lockRow}>
                <Switch value={lockOn} onValueChange={setLockOn} accessibilityLabel={`Unlock with ${lock.ability.method}`} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Unlock with {lock.ability.method}</AppText>
                  <AppText variant="caption" color="textSubtle">
                    This phone stays signed in; {lock.ability.method} keeps it yours.
                  </AppText>
                </View>
              </View>
            ) : (
              <AppText variant="caption" color="textSubtle" style={styles.centred}>
                This phone stays signed in while you keep using the app.
              </AppText>
            )}

            {__DEV__ ? (
              <View style={[styles.preview, { borderColor: t.colors.borderStrong, gap: t.space.sm }]}>
                <AppText variant="label" color="textMuted">
                  DEVELOPER PREVIEW — NOT IN THE STORE APP
                </AppText>
                <AppText variant="caption" color="textSubtle">
                  Open the tabs as a made-up person. Nothing comes from the AMS.
                </AppText>
                <View style={styles.chips}>
                  {PREVIEW.map((p) => (
                    <Pressable
                      key={p.label}
                      accessibilityRole="button"
                      onPress={() => {
                        previewSignIn(p.user);
                        router.replace('/');
                      }}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          borderColor: t.colors.borderStrong,
                          backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface,
                        },
                      ]}
                    >
                      <AppText variant="caption">{p.label}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <AppText variant="caption" color="textSubtle" style={styles.footer}>
              ICSA — Your Partner in Success
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// One size for both sign-in logos, so neither is more prominent (App Review 4.8).
const SOCIAL_SIZE = 48;
const SOCIAL_RADIUS = 10;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { overflow: 'hidden' },
  heroInner: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 30, gap: 6 },
  decor: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 },
  ring: {
    position: 'absolute',
    end: -60,
    top: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 36,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dot: { position: 'absolute', borderRadius: 11 },
  dotYellow: { end: 44, top: 70, width: 22, height: 22, backgroundColor: brand.yellow },
  dotGreen: { end: 86, top: 112, width: 10, height: 10, backgroundColor: brand.green },
  logoTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: brand.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: brand.blue },
  form: {},
  narrow: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  forgot: { alignSelf: 'flex-end', minHeight: minTouch, justifyContent: 'center' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  social: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  // Google's icon button is 48 × 48 by Google's rule; Apple's is made the same size.
  logoButton: { width: SOCIAL_SIZE, height: SOCIAL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.55 },
  centred: { textAlign: 'center' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minTouch },
  preview: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  footer: { textAlign: 'center', marginTop: 8 },
});
