import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppGate } from '@/gate/AppGate';
import { LockProvider } from '@/lock/LockProvider';
import { SessionProvider } from '@/session/SessionContext';
import { AppearanceProvider, useAppearance } from '@/theme/AppearanceProvider';
import { useAppTheme } from '@/theme/useAppTheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // The Light / Dark choice wraps everything, so the splash can wait for it.
  return (
    <AppearanceProvider>
      <Root />
    </AppearanceProvider>
  );
}

function Root() {
  const appearance = useAppearance();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const t = useAppTheme();

  // Hide the splash once the fonts are in — or failed, in which case the
  // system font is used rather than holding the app on the splash forever —
  // and the phone's Light / Dark choice has been read, so a phone set to Dark
  // never shows a light screen first.
  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsDone && appearance.ready) SplashScreen.hideAsync();
  }, [fontsDone, appearance.ready]);

  if (!fontsDone || !appearance.ready) return null;

  const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: t.colors.link,
      background: t.colors.background,
      card: t.colors.surface,
      text: t.colors.text,
      border: t.colors.border,
    },
  };

  return (
    // The update check sits above the lock: an Update screen shows nobody's
    // data, so it needs no Face ID.
    <SessionProvider>
      <AppGate>
        <LockProvider>
          <ThemeProvider value={navTheme}>
            <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </LockProvider>
      </AppGate>
    </SessionProvider>
  );
}
