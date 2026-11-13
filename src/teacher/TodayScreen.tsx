import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { formatClock, formatTime, formatWeekdayDay, statusTone, statusWord } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { Column, WideRow } from '@/components/WideRow';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { StaffDayCard } from '@/staff/StaffDayCard';
import type { Palette } from '@/theme/tokens';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  TEACHER_API,
  checkedIn,
  confirmAllBody,
  confirmAllIds,
  doneList,
  initials,
  pathFor,
  presentBody,
  stuckStudents,
  waitingList,
  walkInLine,
  type Session,
  type StaffContext,
  type WalkIn,
} from './today';

// The teacher's Today (Phase 2 piece 2, mockup 05, approved 3 Nov 2026):
// check-ins waiting for this teacher, today's batch classes with Mark class,
// and two figures — assignments to check, students stuck. Every list and
// figure is the AMS's (staff-context, the review queue, my-classes).

const SHOW = 3;

const TONE: Record<string, { bg: keyof Palette; fg: keyof Palette }> = {
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  info: { bg: 'infoSoft', fg: 'onInfoSoft' },
};

type Outcome = { tone: 'success' | 'warning' | 'danger'; text: string };

export function TodayScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const ctx = useAmsGet<StaffContext>(TEACHER_API.context.path, live);
  const queue = useAmsGet<{ total_pending?: number }>(TEACHER_API.reviewQueue.path, live);
  const classes = useAmsGet<{ needs?: { stuck?: { student_id: string }[] } }>(TEACHER_API.myClasses.path, live);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openedAt] = useState(() => new Date().toISOString());

  const data = ctx.data;
  const waiting = waitingList(data);
  const done = doneList(data);
  const plain = confirmAllIds(waiting);
  const readOnly = !!data?.read_only;
  const sessions = data?.sessions ?? [];
  const day = formatWeekdayDay(data?.today ?? openedAt);

  const present = async (r: WalkIn) => {
    setOutcome(null);
    setBusy(r.attendance_id);
    const res = await ams.request<{ message?: string }>(
      'POST',
      pathFor(TEACHER_API.confirmIndividual.path, { enrollment_id: r.enrollment_id }),
      presentBody(r),
    );
    if (!res.ok) setOutcome({ tone: 'danger', text: res.failure.message });
    await ctx.reload();
    setBusy(null);
  };

  const confirmAll = () => {
    const n = plain.length;
    Alert.alert(`Mark ${n} ${n === 1 ? 'student' : 'students'} present?`, 'Check-ins awaiting review stay for a supervisor.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Mark present',
        onPress: async () => {
          setOutcome(null);
          setBusy('all');
          const res = await ams.request<{ confirmed?: string[]; skipped?: { reason: string }[] }>(
            'POST',
            TEACHER_API.confirmPresent.path,
            confirmAllBody(plain),
          );
          if (!res.ok) {
            setOutcome({ tone: 'danger', text: res.failure.message });
          } else {
            const ok = res.value.confirmed?.length ?? 0;
            const skipped = res.value.skipped ?? [];
            setOutcome({
              tone: skipped.length ? 'warning' : 'success',
              text:
                `${ok} marked present` +
                (skipped.length ? ` · ${skipped.length} not changed: ${skipped[0].reason}` : ''),
            });
          }
          await ctx.reload();
          setBusy(null);
        },
      },
    ]);
  };

  const refresh = () => {
    ctx.refresh();
    queue.refresh();
    classes.refresh();
  };

  if (!live) {
    return (
      <Screen title="Today">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no classes to show.
        </Notice>
      </Screen>
    );
  }

  const shown = showAll ? waiting : waiting.slice(0, SHOW);
  const rest = waiting.slice(SHOW);

  return (
    <Screen
      title="Today"
      eyebrow={[day, user?.branch_name].filter(Boolean).join(' · ')}
      refreshing={ctx.refreshing}
      onRefresh={refresh}
      width="full"
    >
      {ctx.loading && !data ? <Loading what="Loading today’s check-ins…" /> : null}
      {ctx.failure && !data ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} /> : null}
      {ctx.failure && data ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} stale /> : null}
      {readOnly ? <Notice tone="info">This is another day: marks can only be changed on the day itself.</Notice> : null}
      {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}
      <StaffDayCard />

      {/* iPad: the check-ins waiting beside today's classes, then what was marked beside the counts (the approved design). */}
      <WideRow ratios={[1.35, 1]}>
      <Column>
      {data ? (
        waiting.length === 0 ? (
          <Card>
            <AppText variant="headline">No check-ins waiting</AppText>
            <AppText color="textMuted">When a student checks in with you, they appear here.</AppText>
          </Card>
        ) : (
          <View style={[styles.wait, { borderColor: t.colors.attention, borderRadius: t.radius.xl, backgroundColor: t.colors.surface }]}>
            <View style={[styles.waitHead, { backgroundColor: t.colors.warningSoft, padding: t.space.lg }]}>
              <AppText variant="bodyStrong" color="onWarningSoft" style={styles.flex}>
                {`Waiting for you · ${waiting.length} ${waiting.length === 1 ? 'check-in' : 'check-ins'}`}
              </AppText>
              {plain.length > 1 && !readOnly ? (
                <Pressable accessibilityRole="button" hitSlop={10} onPress={confirmAll} disabled={busy !== null}>
                  <AppText variant="bodyStrong" color="link">
                    Confirm all
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            {shown.map((r) => (
              <WaitRow key={r.attendance_id} r={r} readOnly={readOnly} busy={busy} onPresent={() => present(r)} />
            ))}
            {rest.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAll((s) => !s)}
                style={[styles.more, { borderTopColor: t.colors.border, padding: t.space.lg }]}
              >
                <AppText color="textMuted">
                  {showAll
                    ? 'Show fewer'
                    : `+${rest.length} more · ${rest
                        .slice(0, 2)
                        .map((x) => x.student_name + (x.attendance_mode === 'online' ? ' (Online)' : ''))
                        .join(', ')}${rest.length > 2 ? '…' : ''}`}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        )
      ) : null}
      </Column>

      <Column>
      {data ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="headline">Classes</AppText>
          {sessions.length === 0 ? (
            <Card>
              <AppText color="textMuted">No batch classes today. Individual students appear above when they check in.</AppText>
            </Card>
          ) : (
            sessions.map((s) => (
              <ClassRow
                key={s.session_id}
                s={s}
                onMark={() => router.push({ pathname: '/mark-class', params: { session: s.session_id } })}
              />
            ))
          )}
        </View>
      ) : null}
      </Column>
      </WideRow>

      <WideRow ratios={[1.35, 1]}>
      <Column>
      {data && done.length > 0 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            MARKED TODAY
          </AppText>
          <Card>
            {done.slice(0, 8).map((r, i) => {
              const tone = TONE[statusTone(r.status)];
              return (
                <View
                  key={r.attendance_id}
                  style={[styles.doneRow, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}
                >
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{r.student_name}</AppText>
                    <AppText variant="caption" color="textSubtle" numberOfLines={1}>
                      {walkInLine(r, formatTime)}
                    </AppText>
                  </View>
                  <View style={[styles.pill, { backgroundColor: t.colors[tone.bg], borderRadius: t.radius.pill }]}>
                    <AppText variant="label" color={tone.fg}>
                      {statusWord(r.status)}
                    </AppText>
                  </View>
                </View>
              );
            })}
            {done.length > 8 ? (
              <AppText variant="caption" color="textSubtle">
                {`and ${done.length - 8} more`}
              </AppText>
            ) : null}
          </Card>
        </View>
      ) : null}
      </Column>

      <Column>
      <View style={styles.tiles}>
        <Tile
          n={queue.data ? String(queue.data.total_pending ?? 0) : queue.failure ? '—' : '…'}
          label="assignments to check"
          onPress={() => router.navigate('/teacher/assignments')}
        />
        <Tile
          n={classes.data ? String(stuckStudents(classes.data)) : classes.failure ? '—' : '…'}
          label="students stuck"
          alert={!!classes.data && stuckStudents(classes.data) > 0}
          onPress={() => router.navigate('/teacher/classes')}
        />
      </View>
      </Column>
      </WideRow>
    </Screen>
  );
}

function WaitRow({ r, readOnly, busy, onPresent }: { r: WalkIn; readOnly: boolean; busy: string | null; onPresent: () => void }) {
  const t = useAppTheme();
  return (
    <View style={[styles.waitRow, { borderTopColor: t.colors.border, padding: t.space.lg }]}>
      <View style={[styles.avatar, { backgroundColor: t.colors.infoSoft }]}>
        <AppText variant="bodyStrong" color="onInfoSoft">
          {initials(r.student_name)}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{r.student_name}</AppText>
        <AppText variant="caption" color="textSubtle">
          {walkInLine(r, formatTime)}
        </AppText>
        {r.status === 'pending_review' ? (
          <AppText variant="caption" color="onWarningSoft">
            Needs supervisor or manager — the phone reported its location as simulated
          </AppText>
        ) : null}
      </View>
      {r.status === 'pending' && !readOnly ? (
        <Button
          title="Present"
          variant="success"
          block={false}
          busy={busy === r.attendance_id}
          disabled={busy !== null && busy !== r.attendance_id}
          onPress={onPresent}
        />
      ) : null}
    </View>
  );
}

function ClassRow({ s, onMark }: { s: Session; onMark: () => void }) {
  const t = useAppTheme();
  const time = formatClock(s.start_time);
  const [hm, ampm] = time ? time.split(' ') : ['—', ''];
  const inCount = checkedIn(s.roster);
  return (
    <Card>
      <View style={styles.classRow}>
        <View style={[styles.time, { borderRightColor: t.colors.border }]}>
          <AppText variant="title">{hm}</AppText>
          <AppText variant="caption" color="textSubtle">
            {ampm}
          </AppText>
        </View>
        <View style={[styles.flex, { gap: t.space.xs }]}>
          <AppText variant="headline">{s.course_name ?? 'Class'}</AppText>
          <AppText variant="caption" color="textSubtle">
            {[s.batch_name, s.branch_name, `${s.roster.length} ${s.roster.length === 1 ? 'student' : 'students'}`]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: t.colors.successSoft, borderRadius: t.radius.pill }]}>
              <AppText variant="label" color="onSuccessSoft">
                {`${inCount} checked in`}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onMark}
              hitSlop={8}
              style={[styles.chip, { backgroundColor: t.colors.infoSoft, borderRadius: t.radius.pill }]}
            >
              <AppText variant="label" color="onInfoSoft">
                Mark class
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Card>
  );
}

function Tile({ n, label, alert = false, onPress }: { n: string; label: string; alert?: boolean; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}
    >
      <AppText variant="title" color={alert ? 'onDangerSoft' : 'text'}>
        {n}
      </AppText>
      <AppText variant="caption" color="textSubtle">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wait: { borderWidth: 1, overflow: 'hidden' },
  waitHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  more: { borderTopWidth: 1, minHeight: minTouch, justifyContent: 'center' },
  classRow: { flexDirection: 'row', gap: 14 },
  time: { width: 64, alignItems: 'center', borderRightWidth: 1, paddingRight: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, minHeight: 32, justifyContent: 'center' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 1, padding: 14, gap: 2 },
});
