import { StyleSheet, View } from 'react-native';

import type { Palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<Tone, { bg: keyof Palette; fg: keyof Palette }> = {
  info: { bg: 'infoSoft', fg: 'onInfoSoft' },
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
};

/** An inline banner. Errors name what happened — never a silent failure. */
export function Notice({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: string }) {
  const t = useAppTheme();
  const c = TONE[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      style={[styles.box, { backgroundColor: t.colors[c.bg], borderRadius: t.radius.md }]}
    >
      {title ? (
        <AppText variant="bodyStrong" color={c.fg}>
          {title}
        </AppText>
      ) : null}
      <AppText variant="caption" color={c.fg}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
});
