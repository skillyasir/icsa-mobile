import { Text, type TextProps } from 'react-native';

import type { Palette, TypeVariant } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = TextProps & {
  variant?: TypeVariant;
  /** A palette key, so screens never hard-code a colour. */
  color?: keyof Palette;
};

/**
 * All text in the app. Nunito in the chosen size; follows the phone's text
 * size setting (Dynamic Type / font scale) — capped so a layout never breaks.
 */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const t = useAppTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.8}
      {...rest}
      style={[t.type[variant], { color: t.colors[color] }, style]}
    />
  );
}
