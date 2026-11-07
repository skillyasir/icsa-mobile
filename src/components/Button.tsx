import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

type Variant = 'primary' | 'outline' | 'apple' | 'danger' | 'attention' | 'success';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  busy?: boolean;
  /** Fill the row (default) or size to the text. */
  block?: boolean;
};

export function Button({ title, variant = 'primary', busy = false, block = true, disabled, ...rest }: Props) {
  const t = useAppTheme();
  const c = t.colors;

  const look: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, pressed: c.primaryPressed, fg: c.onPrimary },
    outline: { bg: c.surface, pressed: c.surfaceMuted, fg: c.text, border: c.borderStrong },
    apple: { bg: c.appleButton, pressed: c.appleButton, fg: c.onAppleButton },
    danger: { bg: c.surface, pressed: c.dangerSoft, fg: c.onDangerSoft, border: c.borderStrong },
    attention: { bg: c.attention, pressed: c.attentionPressed, fg: c.onAttention },
    success: { bg: c.success, pressed: c.successPressed, fg: c.onSuccess },
  };
  const v = look[variant];
  const isDisabled = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        {
          backgroundColor: pressed ? v.pressed : v.bg,
          borderColor: v.border ?? 'transparent',
          opacity: isDisabled ? 0.55 : 1,
          borderRadius: t.radius.lg,
        },
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator color={v.fg} /> : null}
        <AppText variant="button" style={{ color: v.fg }} numberOfLines={1}>
          {title}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: Math.max(minTouch, 50),
    paddingHorizontal: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
