import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { useLayout } from '@/layout/useLayout';
import { useAppTheme } from '@/theme/useAppTheme';

import { STATUS_TONE, coursesLine, listPath, searchParam, type StudentRow } from './students';
import { StudentScreen } from './StudentScreen';

// The teacher's Students tab (built 8 Nov 2026): the students he teaches —
// the AMS lists only those, search or not — with their attendance status.
// Tap one for their contact, courses and attendance.

export function StudentsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const [text, setText] = useState('');
  const [search, setSearch] = useState<string | null>(null);
  const data = useAmsGet<{ count: number; students: StudentRow[] }>(listPath(search), live);
  const rows = data.data?.students ?? [];
  // iPad with room (the approved design, mockup 18): the open student sits beside the list.
  const { split } = useLayout();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = split ? (rows.find((r) => r.id === openId) ?? rows[0] ?? null) : null;

  if (!live) {
    return (
      <Screen title="Students">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no students to show.
        </Notice>
      </Screen>
    );
  }

  return (
    <Screen
      title="Students"
      refreshing={data.refreshing}
      onRefresh={data.refresh}
      aside={split ? open ? <StudentScreen key={open.id} studentId={open.id} embedded /> : <View /> : undefined}
    >
      <TextField
        label="Search your students"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setSearch(searchParam(text))}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="Name, student code or phone"
        clearButtonMode="while-editing"
        onEndEditing={() => setSearch(searchParam(text))}
      />
      {data.loading && !data.data ? <Loading what="Loading your students…" /> : null}
      {data.failure ? <LoadFailed failure={data.failure} onRetry={data.refresh} stale={!!data.data} /> : null}
      {data.data ? (
        <AppText variant="caption" color="textSubtle">
          {search ? `${rows.length} found for “${search}”` : `${rows.length} student${rows.length === 1 ? '' : 's'} you teach`}
        </AppText>
      ) : null}
      {data.data && rows.length === 0 ? (
        <Card>
          <AppText color="textMuted">{search ? 'None of your students match.' : 'You have no students yet.'}</AppText>
        </Card>
      ) : null}
      {rows.map((s) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityState={{ selected: open?.id === s.id }}
          onPress={() => (split ? setOpenId(s.id) : router.push({ pathname: '/teacher/students/profile', params: { id: s.id } }))}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: open?.id === s.id ? t.colors.infoSoft : pressed ? t.colors.surfaceMuted : t.colors.surface,
              borderColor: open?.id === s.id ? t.colors.primary : t.colors.border,
              borderRadius: t.radius.xl,
            },
            open?.id === s.id && styles.openRow,
          ]}
        >
          <View style={[styles.flex, { gap: 2 }]}>
            <View style={styles.head}>
              <AppText variant="headline" style={styles.flex} numberOfLines={1}>
                {s.full_name ?? 'Student'}
              </AppText>
              {s.status ? <Pill text={s.status} tone={STATUS_TONE[s.status] ?? 'muted'} /> : null}
            </View>
            <AppText variant="caption" color="textSubtle" numberOfLines={1}>
              {[s.student_code, s.last_present ? `last here ${formatDay(s.last_present)}` : 'not attended yet'].filter(Boolean).join(' · ')}
            </AppText>
            {coursesLine(s.enrollments) ? (
              <AppText color="textMuted" numberOfLines={2}>
                {coursesLine(s.enrollments)}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  row: { borderWidth: 1, padding: 14 },
  openRow: { borderWidth: 2.5 },
});
