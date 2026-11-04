import { useColorScheme } from 'react-native';

import { palettes, radius, space, type, type ColorScheme, type Palette } from './tokens';

export type AppTheme = {
  scheme: ColorScheme;
  colors: Palette;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
};

/** The current light or dark theme, following the phone's own setting. */
export function useAppTheme(): AppTheme {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palettes[scheme], type, space, radius };
}
