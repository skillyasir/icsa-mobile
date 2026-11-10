import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLUMN_MAX, LIST_PANE } from '@/layout/breakpoints';
import { useLayout } from '@/layout/useLayout';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';

/**
 * A tab screen: safe area, scrolls, large title like the iOS large-title style.
 * Pass onRefresh for pull-to-refresh; `top` sits above the title (a back link);
 * `footer` stays below the scrolling part (a Save button).
 *
 * On an iPad (10 Nov 2026, the approved iPad designs):
 * - `width` "column" (the default) centres the screen at COLUMN_MAX, never
 *   stretched across a 13" display; "full" gives a dashboard the whole width
 *   (it lays itself out with <WideRow>).
 * - `aside` is a list's open item: with room (SPLIT_MIN) the list scrolls in a
 *   pane on the left and the item beside it; otherwise `aside` is not shown
 *   and the list opens its items as before.
 * - `embedded` is a screen drawn as someone else's `aside`: no safe area of
 *   its own (the list's screen has it).
 * A phone is unchanged.
 */
export function Screen({
  title,
  eyebrow,
  top,
  refreshing = false,
  onRefresh,
  footer,
  width = 'column',
  aside,
  embedded = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  top?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  width?: 'column' | 'full';
  aside?: ReactNode;
  embedded?: boolean;
  children: ReactNode;
}) {
  const t = useAppTheme();
  const { wide, split } = useLayout();
  const sideBySide = split && aside !== undefined;
  const pad = wide ? { paddingHorizontal: t.space.xxxl + 8, paddingVertical: t.space.xxxl } : { padding: t.space.xl };
  const column = wide && width === 'column' && !sideBySide ? styles.column : null;

  const body = (
    <ScrollView
      style={sideBySide ? [styles.pane, { borderRightColor: t.colors.border }] : undefined}
      contentContainerStyle={[styles.content, pad, { gap: t.space.lg }, column]}
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
  );

  return (
    // A screen with a footer is pushed over the tabs (no tab bar), so the
    // footer keeps clear of the home indicator itself.
    <SafeAreaView
      edges={embedded ? [] : footer ? ['top', 'bottom'] : ['top']}
      style={[styles.fill, { backgroundColor: t.colors.background }]}
    >
      {sideBySide ? (
        <View style={styles.split}>
          {body}
          <View style={styles.fill}>{aside}</View>
        </View>
      ) : (
        body
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { borderTopColor: t.colors.border, backgroundColor: t.colors.surface, padding: t.space.lg },
          ]}
        >
          <View style={[{ gap: t.space.sm }, column]}>{footer}</View>
        </View>
      ) : null}
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
  footer: { borderTopWidth: 1 },
  column: { width: '100%', maxWidth: COLUMN_MAX, alignSelf: 'center' },
  split: { flex: 1, flexDirection: 'row' },
  pane: { width: LIST_PANE, flexGrow: 0, flexShrink: 0, borderRightWidth: StyleSheet.hairlineWidth * 2 },
});
