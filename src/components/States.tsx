import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { Failure } from '@/api/session';
import { useAppTheme } from '@/theme/useAppTheme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Notice } from './Notice';
import { Card } from './Screen';

/** While a screen's first answer is on its way. */
export function Loading({ what }: { what: string }) {
  const t = useAppTheme();
  return (
    <Card>
      <View style={styles.row}>
        <ActivityIndicator color={t.colors.textSubtle} />
        <AppText color="textMuted">{what}</AppText>
      </View>
    </Card>
  );
}

/**
 * A read that failed, in the AMS's words (or "Cannot reach ICSA" offline),
 * with a way to try again. `stale` = older figures are still on the screen.
 */
export function LoadFailed({ failure, onRetry, stale = false }: { failure: Failure; onRetry: () => void; stale?: boolean }) {
  const t = useAppTheme();
  return (
    <View style={{ gap: t.space.sm }}>
      <Notice tone={failure.kind === 'offline' ? 'warning' : 'danger'} title={stale ? 'Showing what was loaded earlier' : undefined}>
        {failure.message}
      </Notice>
      <Button title="Try again" variant="outline" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
