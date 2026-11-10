import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { phoneStore } from '@/api/client';

import { APPEARANCE_KEY, DEFAULT_APPEARANCE, overrideFor, parseAppearance, type AppearanceChoice } from './appearance';

// Applies the phone's Light / Dark / Same-as-phone choice to the whole app.
// React Native's own override is used, so every useColorScheme() — the theme,
// the navigation, Apple's and Google's buttons, the keyboard — follows it.
//
// The default is applied before anything renders, so nobody sees the phone's
// Dark Mode flash in first; the saved choice is read while the splash is still
// up (`ready` holds the splash).

Appearance.setColorScheme(overrideFor(DEFAULT_APPEARANCE));

type AppearanceState = {
  choice: AppearanceChoice;
  ready: boolean;
  setChoice: (choice: AppearanceChoice) => Promise<void>;
};

const AppearanceContext = createContext<AppearanceState>({
  choice: DEFAULT_APPEARANCE,
  ready: true,
  setChoice: async () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<AppearanceChoice>(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    phoneStore
      .get(APPEARANCE_KEY)
      .catch(() => null)
      .then((saved) => {
        if (!live) return;
        const c = parseAppearance(saved);
        Appearance.setColorScheme(overrideFor(c));
        setChoiceState(c);
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const setChoice = useCallback(async (c: AppearanceChoice) => {
    Appearance.setColorScheme(overrideFor(c));
    setChoiceState(c);
    // The choice is already on screen; a phone that cannot save it simply
    // starts light again next time.
    await phoneStore.set(APPEARANCE_KEY, c).catch(() => {});
  }, []);

  return <AppearanceContext.Provider value={{ choice, ready, setChoice }}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);
