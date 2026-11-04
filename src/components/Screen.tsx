import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

/** A tab screen: safe area, scrolls, large title like the iOS large-title style. */
export function Screen({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const t = useAppTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: t.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: t.space.xl, gap: t.space.lg }]}>
        <View style={{ gap: t.space.xs }}>
          {eyebrow ? (
            <AppText variant="caption" color="textSubtle">
              {eyebrow}
            </AppText>
          ) : null}
          <AppText variant="largeTitle" accessibilityRole="header">
            {title}
          </AppText>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A white rounded card on the screen background. */
export function Card({ children }: { children: ReactNode }) {
  const t = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderRadius: t.radius.xl,
          padding: t.space.lg,
          gap: t.space.md,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: 40 },
  card: { borderWidth: 1 },
});
