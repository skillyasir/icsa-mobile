import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

/**
 * A tab screen: safe area, scrolls, large title like the iOS large-title style.
 * Pass onRefresh for pull-to-refresh; `top` sits above the title (a back link).
 */
export function Screen({
  title,
  eyebrow,
  top,
  refreshing = false,
  onRefresh,
  children,
}: {
  title: string;
  eyebrow?: string;
  top?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const t = useAppTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: t.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: t.space.xl, gap: t.space.lg }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.colors.textSubtle} /> : undefined}
      >
        {top}
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
