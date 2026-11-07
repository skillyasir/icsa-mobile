import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { formatDay, formatTime } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import type { Palette } from '@/theme/tokens';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  SETTABLE,
  TEACHER_API,
  minutesLate,
  pathFor,
  rosterCounts,
  rowMarkable,
  sessionChanges,
  setDraft,
  type Drafts,
  type RosterRow,
  type Settable,
  type StaffContext,
} from './today';

// Mark a batch class (Phase 2 piece 2, mockup 06, approved 3 Nov 2026):
// present / late / absent / excused for each student who checked in, saved
// together. Pushed over the tabs from Today. The AMS decides: today only for a
// teacher, never a check-in awaiting review, and a student with no check-in
// has no record to mark (the AMS skips them), so they get no buttons here.

const LETTER: Record<Settable, string> = { present: 'P', late: 'L', absent: 'A', excused: 'E' };
const ON: Record<Settable, { bg: keyof Palette; fg: keyof Palette }> = {
  present: { bg: 'success', fg: 'onSuccess' },
  late: { bg: 'attention', fg: 'onAttention' },
  absent: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  excused: { bg: 'infoSoft', fg: 'onInfoSoft' },
};

type Saved = { updated?: number; skipped_no_shows?: number; errors?: { enrollment_id: string; error: string }[] };

export function MarkClassScreen() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  const router = useRouter();
  const t = useAppTheme();
  const { user } = useSession();
  const ctx = useAmsGet<StaffContext>(TEACHER_API.context.path, !user?.preview);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  const s = ctx.data?.sessions.find((x) => x.session_id === session) ?? null;
  const readOnly = !!ctx.data?.read_only;
  const changed = Object.keys(drafts).length;

  const leave = () => {
    const go = () => (router.canGoBack() ? router.back() : router.replace('/teacher'));
    if (changed === 0) return go();
    Alert.alert(`Discard ${changed} ${changed === 1 ? 'change' : 'changes'}?`, 'They have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: go },
    ]);
  };

  const save = async () => {
    if (!s || changed === 0) return;
    setOutcome(null);
    setBusy(true);
    const res = await ams.request<Saved>('POST', pathFor(TEACHER_API.confirmSession.path, { session_id: s.session_id }), sessionChanges(drafts));
    if (!res.ok) {
      setOutcome({ tone: 'danger', text: res.failure.message });
      setBusy(false);
      return;
    }
    const errors = res.value.errors ?? [];
    const name = (id: string) => s.roster.find((r) => r.enrollment_id === id)?.student_name ?? 'A student';
    setOutcome(
      errors.length
        ? { tone: 'warning', text: `${res.value.updated ?? 0} saved. Not saved: ${errors.map((e) => `${name(e.enrollment_id)} — ${e.error}`).join('; ')}` }
        : { tone: 'success', text: `${res.value.updated ?? 0} saved.` },
    );
    setDrafts({});
    await ctx.reload();
    setBusy(false);
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={leave}>
      <AppText variant="bodyStrong" color="link">
        ‹ Today
      </AppText>
    </Pressable>
  );

  if (!s) {
    return (
      <Screen title="Mark class" top={back}>
        {ctx.loading && !ctx.data ? <Loading what="Loading the class…" /> : null}
        {ctx.failure && !ctx.data ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} /> : null}
        {ctx.data ? (
          <Card>
            <AppText variant="headline">This class is not on today’s list</AppText>
            <AppText color="textMuted">It may have been moved or cancelled. Go back to Today for the current list.</AppText>
          </Card>
        ) : null}
      </Screen>
    );
  }

  const n = rosterCounts(s.roster, drafts);
  const tiles: { label: string; value: number; bg: keyof Palette; fg: keyof Palette }[] = [
    { label: 'Present', value: n.present, bg: 'successSoft', fg: 'onSuccessSoft' },
    { label: 'Late', value: n.late, bg: 'warningSoft', fg: 'onWarningSoft' },
    { label: 'Absent', value: n.absent, bg: 'dangerSoft', fg: 'onDangerSoft' },
    ...(n.excused > 0 ? [{ label: 'Excused', value: n.excused, bg: 'infoSoft' as const, fg: 'onInfoSoft' as const }] : []),
    { label: 'Not marked', value: n.waiting, bg: 'surfaceMuted', fg: 'textMuted' },
  ];

  return (
    <Screen
      title={[s.course_name, s.batch_name].filter(Boolean).join(' — ')}
      eyebrow={[formatDay(s.session_date), s.branch_name].filter(Boolean).join(' · ')}
      top={back}
      refreshing={ctx.refreshing}
      onRefresh={changed === 0 ? ctx.refresh : undefined}
      footer={
        readOnly ? undefined : (
          <>
            <Button title={changed ? `Save changes (${changed})` : 'No changes'} busy={busy} disabled={changed === 0} onPress={save} />
            <AppText variant="caption" color="textSubtle" style={styles.center}>
              P present · L late · A absent · E excused — today only
            </AppText>
          </>
        )
      }
    >
      {readOnly ? <Notice tone="info">This is another day: marks can only be changed on the day itself.</Notice> : null}
      {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}
      {ctx.failure ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} stale /> : null}

      <View style={styles.tiles}>
        {tiles.map((x) => (
          <View key={x.label} style={[styles.tile, { backgroundColor: t.colors[x.bg], borderRadius: t.radius.lg }]}>
            <AppText variant="title" color={x.fg}>
              {String(x.value)}
            </AppText>
            <AppText variant="caption" color={x.fg} numberOfLines={1}>
              {x.label}
            </AppText>
          </View>
        ))}
      </View>

      {s.roster.length === 0 ? (
        <Card>
          <AppText color="textMuted">No students are enrolled in this class.</AppText>
        </Card>
      ) : (
        <Card>
          {s.roster.map((r, i) => (
            <RosterLine
              key={r.enrollment_id}
              r={r}
              first={i === 0}
              start={s.start_time}
              current={drafts[r.enrollment_id] ?? r.status}
              markable={rowMarkable(r, readOnly) && !busy}
              onPick={(status) => setDrafts((d) => setDraft(d, r, status))}
            />
          ))}
        </Card>
      )}
      {n.none > 0 ? (
        <AppText variant="caption" color="textSubtle">
          {`${n.none} without a check-in today: there is no record to mark, so the AMS leaves them out.`}
        </AppText>
      ) : null}
    </Screen>
  );
}

function RosterLine(props: {
  r: RosterRow;
  first: boolean;
  start: string | null;
  current: string | null;
  markable: boolean;
  onPick: (s: Settable) => void;
}) {
  const { r, first, start, current, markable } = props;
  const t = useAppTheme();
  const late = r.attendance_id && r.attendance_mode !== 'online' ? minutesLate(start, r.check_in_time) : 0;
  const line = !r.attendance_id
    ? 'No check-in'
    : r.attendance_mode === 'online'
      ? `Online · in class since ${formatTime(r.check_in_time)}`
      : [`Checked in ${formatTime(r.check_in_time)}`, r.check_in_distance_m != null ? `${Math.round(Number(r.check_in_distance_m))} m` : '']
          .filter(Boolean)
          .join(' · ');
  return (
    <View style={[styles.line, !first && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{r.student_name}</AppText>
        <AppText variant="caption" color={late > 0 ? 'onWarningSoft' : 'textSubtle'}>
          {late > 0 ? `${line} · ${late} min late` : line}
        </AppText>
        {r.status === 'pending_review' ? (
          <AppText variant="caption" color="onWarningSoft">
            Needs supervisor or manager
          </AppText>
        ) : null}
      </View>
      {r.attendance_id && r.status !== 'pending_review' ? (
        <View style={[styles.seg, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.md }]}>
          {SETTABLE.map((st) => {
            const on = current === st;
            return (
              <Pressable
                key={st}
                accessibilityRole="radio"
                accessibilityLabel={st}
                accessibilityState={{ selected: on, disabled: !markable }}
                disabled={!markable}
                onPress={() => props.onPick(st)}
                style={[
                  styles.segBtn,
                  { borderRadius: t.radius.sm },
                  on && { backgroundColor: t.colors[ON[st].bg] },
                  !markable && !on && { opacity: 0.5 },
                ]}
              >
                <AppText variant="bodyStrong" color={on ? ON[st].fg : 'textMuted'}>
                  {LETTER[st]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  seg: { flexDirection: 'row', padding: 3, gap: 2 },
  segBtn: { width: 38, height: minTouch, alignItems: 'center', justifyContent: 'center' },
});
