import { StyleSheet, View } from 'react-native';

import type { Palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

// A small status pill — "Submitted", "Needs revision", "84%". Its tone names
// what it means; the colours come from the theme, so dark mode follows.

export type PillTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

const TONES: Record<PillTone, { bg: keyof Palette; fg: keyof Palette }> = {
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  info: { bg: 'infoSoft', fg: 'onInfoSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  muted: { bg: 'surfaceMuted', fg: 'textMuted' },
};

export function Pill({ text, tone }: { text: string; tone: PillTone }) {
  const t = useAppTheme();
  const c = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.colors[c.bg], borderRadius: t.radius.pill }]}>
      <AppText variant="label" color={c.fg}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
});
