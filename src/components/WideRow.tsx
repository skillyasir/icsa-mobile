import { Children, type ReactNode } from 'react';
import { View } from 'react-native';

import { useLayout } from '@/layout/useLayout';
import { useAppTheme } from '@/theme/useAppTheme';

/**
 * Side by side on an iPad, one after the other on a phone — in the SAME order,
 * so a phone shows exactly what it showed before the iPad layout. Each child
 * is usually a <Column>; `ratios` sets their widths (default equal).
 */
export function WideRow({ children, ratios }: { children: ReactNode; ratios?: number[] }) {
  const t = useAppTheme();
  const { wide } = useLayout();
  const kids = Children.toArray(children);
  if (!wide) return <>{kids}</>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.space.xl }}>
      {kids.map((k, i) => (
        <View key={i} style={{ flex: ratios?.[i] ?? 1, minWidth: 0 }}>
          {k}
        </View>
      ))}
    </View>
  );
}

/** A group of a screen's sections, spaced as the screen spaces them; nothing when it is empty. */
export function Column({ children }: { children: ReactNode }) {
  const t = useAppTheme();
  const kids = Children.toArray(children);
  if (kids.length === 0) return null;
  return <View style={{ gap: t.space.lg }}>{kids}</View>;
}
