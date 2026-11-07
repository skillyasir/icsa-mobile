import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import type { Failure } from '@/api/session';
import { formatDay, formatTime } from '@/attendance/rules';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import type { Palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  ASSIGNMENT_API,
  SUBMISSION_WORD,
  fileName,
  filterRows,
  rowsOf,
  type Filter,
  type QueueItem,
  type Row,
  type SubmissionsAnswer,
} from './assignments';
import { pathFor } from './today';

// Check assignments (mockup 07, built 7 Nov 2026): every submission of the
// assignments in this teacher's review queue, To check first. Tap one to
// review it. The queue and the submissions are the AMS's own lists, scoped by
// the AMS to the students this teacher teaches.

const TONE: Record<string, { bg: keyof Palette; fg: keyof Palette }> = {
  submitted: { bg: 'infoSoft', fg: 'onInfoSoft' },
  approved: { bg: 'successSoft', fg: 'onSuccessSoft' },
  needs_revision: { bg: 'warningSoft', fg: 'onWarningSoft' },
};

export function AssignmentsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('to_check');
  const latest = useRef(0);

  // The queue, then each assignment's submissions — the queue is a handful.
  const load = useCallback(
    async (pull: boolean) => {
      if (!live) return;
      const mine = ++latest.current;
      if (pull) setRefreshing(true);
      const q = await ams.request<{ assignments?: QueueItem[] }>('GET', ASSIGNMENT_API.queue.path);
      if (!q.ok) {
        if (mine === latest.current) {
          setFailure(q.failure);
          setRefreshing(false);
        }
        return;
      }
      const answers: SubmissionsAnswer[] = [];
      let bad: Failure | null = null;
      for (const a of q.value.assignments ?? []) {
        const s = await ams.request<SubmissionsAnswer>('GET', pathFor(ASSIGNMENT_API.submissions.path, { id: a.id }));
        if (s.ok) answers.push(s.value);
        else bad = s.failure;
      }
      if (mine !== latest.current) return;
      setRows(rowsOf(answers));
      setFailure(bad);
      setRefreshing(false);
    },
    [live],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (!live) {
    return (
      <Screen title="Check assignments">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there is nothing to check.
        </Notice>
      </Screen>
    );
  }

  const all = rows ?? [];
  const shown = filterRows(all, filter);
  const counts = { to_check: filterRows(all, 'to_check').length, returned: filterRows(all, 'returned').length, all: all.length };
  const chips: { key: Filter; label: string }[] = [
    { key: 'to_check', label: `To check ${counts.to_check}` },
    { key: 'returned', label: `Returned ${counts.returned}` },
    { key: 'all', label: `All ${counts.all}` },
  ];

  return (
    <Screen title="Check assignments" refreshing={refreshing} onRefresh={() => load(true)}>
      <View style={styles.chips}>
        {chips.map((c) => {
          const on = c.key === filter;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(c.key)}
              style={[
                styles.chip,
                { borderRadius: t.radius.pill, borderColor: t.colors.borderStrong, backgroundColor: on ? t.colors.text : t.colors.surface },
              ]}
            >
              <AppText variant="bodyStrong" color={on ? 'surface' : 'textMuted'}>
                {c.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {rows === null && !failure ? <Loading what="Loading submissions…" /> : null}
      {failure ? <LoadFailed failure={failure} onRetry={() => load(true)} stale={rows !== null} /> : null}
      {rows !== null && shown.length === 0 ? (
        <Card>
          <AppText color="textMuted">
            {filter === 'to_check' ? 'Nothing to check. Every submission has been reviewed.' : 'Nothing here.'}
          </AppText>
        </Card>
      ) : null}

      {shown.map((r) => {
        const tone = TONE[r.status] ?? TONE.submitted;
        return (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/teacher/assignments/review', params: { assignment: r.assignment_id, submission: r.id } })}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface,
                borderColor: r.status === 'submitted' ? t.colors.primary : t.colors.border,
                borderRadius: t.radius.xl,
                padding: t.space.lg,
                gap: t.space.xs,
              },
            ]}
          >
            <View style={styles.head}>
              <AppText variant="headline" style={styles.flex}>
                {r.student_name}
              </AppText>
              <AppText variant="caption" color="textSubtle">
                {`${formatDay(r.submitted_at)} · ${formatTime(r.submitted_at)}`}
              </AppText>
            </View>
            <AppText color="textMuted">{`${r.title} · ${r.subject_name}`}</AppText>
            <View style={styles.head}>
              {r.file_url ? (
                <AppText variant="caption" color="link" numberOfLines={1} style={styles.flex}>
                  {fileName(r.file_url)}
                </AppText>
              ) : (
                <View style={styles.flex} />
              )}
              <View style={[styles.pill, { backgroundColor: t.colors[tone.bg], borderRadius: t.radius.pill }]}>
                <AppText variant="label" color={tone.fg}>
                  {SUBMISSION_WORD[r.status] ?? r.status}
                </AppText>
              </View>
            </View>
          </Pressable>
        );
      })}
      {rows !== null ? (
        <AppText variant="caption" color="textSubtle">
          Lists the assignments that have submissions waiting, with every submission each one has.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1 },
  row: { borderWidth: 1.5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4 },
});
