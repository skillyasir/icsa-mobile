import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Chips } from '@/reception/ui';
import { useAppTheme } from '@/theme/useAppTheme';

import { branchChips, branchLabel, type Branch } from './reports';

/**
 * "All branches ▾" — tap to choose one branch, or all of them again. Hidden
 * while the AMS's branch list has not come (the screen then shows every
 * branch, which is what no choice means) and when there is only one branch.
 */
export function BranchPick({ branches, value, onChange }: { branches: readonly Branch[] | null | undefined; value: string; onChange: (v: string) => void }) {
  const t = useAppTheme();
  const [open, setOpen] = useState(false);
  if (!branches || branches.length < 2) return null;
  return (
    <View style={{ gap: t.space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Branch: ${branchLabel(branches, value)}`}
        accessibilityHint="Choose a branch"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.pill, { borderRadius: t.radius.pill, borderColor: t.colors.borderStrong, backgroundColor: t.colors.surface, opacity: pressed ? 0.85 : 1 }]}
      >
        <AppText variant="bodyStrong">{`${branchLabel(branches, value)} ${open ? '▴' : '▾'}`}</AppText>
      </Pressable>
      {open ? (
        <Chips
          options={branchChips(branches)}
          value={value}
          onChange={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 14, borderWidth: 1.5, justifyContent: 'center' },
});
