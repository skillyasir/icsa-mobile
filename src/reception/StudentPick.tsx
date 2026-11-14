import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { listPath, searchParam, type StudentRow } from '@/teacher/students';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// Which student? (Take payment and Enrol opened from Today or New.) The AMS's
// own student search — the same list the Students tab reads, scoped by the AMS.

export function StudentPick({ onPick }: { onPick: (id: string) => void }) {
  const t = useAppTheme();
  const [q, setQ] = useState('');
  const search = searchParam(q);
  const list = useAmsGet<{ students: StudentRow[] }>(listPath(search), !!search);
  const rows = list.data?.students ?? [];
  return (
    <Card>
      <TextField label="Find the student" value={q} onChangeText={setQ} placeholder="Name, phone, STU code or Civil ID" autoCorrect={false} autoFocus />
      {!search ? <AppText color="textMuted">Type at least 2 letters or digits.</AppText> : null}
      {search && list.loading && !list.data ? <Loading what="Searching…" /> : null}
      {search && list.failure ? <LoadFailed failure={list.failure} onRetry={list.refresh} stale={!!list.data} /> : null}
      {search && list.data && rows.length === 0 ? <AppText color="textMuted">No student matches.</AppText> : null}
      <View style={{ gap: t.space.sm }}>
        {rows.slice(0, 20).map((s) => (
          <Pressable key={s.id} accessibilityRole="button" onPress={() => onPick(s.id)} style={[styles.row, { borderColor: t.colors.border, borderRadius: t.radius.md }]}>
            <AppText variant="bodyStrong">{s.full_name ?? 'Student'}</AppText>
            <AppText variant="caption" color="textSubtle">
              {[s.student_code, s.phone, s.branch_name].filter(Boolean).join(' · ')}
            </AppText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minHeight: minTouch, justifyContent: 'center' },
});
