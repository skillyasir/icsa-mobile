import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { font } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

type Props = TextInputProps & { label: string };

/** A labelled text input. The label is a real accessibility label. */
export function TextField({ label, onFocus, onBlur, style, ...rest }: Props) {
  const t = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="textMuted">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.colors.textSubtle}
        maxFontSizeMultiplier={1.8}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            color: t.colors.text,
            backgroundColor: t.colors.surface,
            borderColor: focused ? t.colors.primary : t.colors.borderStrong,
            borderRadius: t.radius.md,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontFamily: font.regular,
    fontSize: 16,
  },
});
