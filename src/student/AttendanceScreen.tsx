import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  ATTENDANCE_API,
  classTimes,
  formatDay,
  formatTime,
  placeLabel,
  statusTone,
  statusView,
  statusWord,
} from '@/attendance/rules';
import { attendanceList, todayClasses, type TodayClass } from '@/attendance/today';
import type { MyContext, MyHistory } from '@/attendance/types';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import type { Palette } from '@/theme/tokens';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

// The Attendance tab (Phase 2 piece 1, 6 Nov 2026): today's classes with
// their check-in, then the student's attendance as the AMS records it.
// Figures are the AMS's (my-history's summary), never counted on the phone.

const SHOW = 60;

const TONE_COLOURS: Record<string, { bg: keyof Palette; fg: keyof Palette }> = {
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  info: { bg: 'infoSoft', fg: 'onInfoSoft' },
};

export function AttendanceScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const ctx = useAmsGet<MyContext>(ATTENDANCE_API.context.path, live);
  const hist = useAmsGet<MyHistory>(ATTENDANCE_API.history.path, live);
  const classes = attendanceList(todayClasses(ctx.data));
  const refresh = () => {
    ctx.refresh();
    hist.refresh();
  };
  const open = (c: TodayClass, start: boolean) =>
    router.push({ pathname: '/student/attendance/check-in', params: { enrollment: c.enrollmentId, ...(start ? { start: '1' } : {}) } });

  if (!live) {
    return (
      <Screen title="Attendance">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there is no attendance to show.
        </Notice>
      </Screen>
    );
  }

  const s = hist.data?.summary;
  const records = hist.data?.records ?? [];

  return (
    <Screen title="Attendance" refreshing={ctx.refreshing || hist.refreshing} onRefresh={refresh}>
      <AppText variant="label" color="textMuted">
        YOUR CLASSES
      </AppText>
      {ctx.loading && !ctx.data ? (
        <Loading what="Loading today’s classes…" />
      ) : ctx.failure && !ctx.data ? (
        <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} />
      ) : classes.length === 0 ? (
        <Card>
          <AppText variant="headline">No classes yet</AppText>
          <AppText color="textMuted">When you are enrolled in a class, you check in here.</AppText>
        </Card>
      ) : (
        classes.map((c) => <TodayCard key={c.enrollmentId} c={c} onOpen={(start) => open(c, start)} />)
      )}

      <AppText variant="label" color="textMuted">
        HISTORY
      </AppText>
      {hist.loading && !hist.data ? (
        <Loading what="Loading your attendance…" />
      ) : hist.failure && !hist.data ? (
        <LoadFailed failure={hist.failure} onRetry={hist.refresh} />
      ) : (
        <>
          {s ? (
            <View style={styles.tiles}>
              <Tile n={s.present} label="Present" />
              <Tile n={s.late} label="Late" />
              <Tile n={s.absent} label="Absent" />
              <Tile n={s.pending + s.pending_review} label="Waiting" />
            </View>
          ) : null}
          {records.length === 0 ? (
            <Card>
              <AppText color="textMuted">No attendance recorded yet.</AppText>
            </Card>
          ) : (
            <Card>
              {records.slice(0, SHOW).map((r, i) => {
                const tone = TONE_COLOURS[statusTone(r.status)];
                return (
                  <View
                    key={r.id}
                    style={[styles.rec, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}
                  >
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{formatDay(r.attendance_date)}</AppText>
                      <AppText variant="caption" color="textSubtle" numberOfLines={2}>
                        {[r.course_name, placeLabel(r.attendance_mode, r.attended_branch_name), formatTime(r.check_in_time)]
                          .filter(Boolean)
                          .join(' · ')}
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
              {records.length > SHOW ? (
                <AppText variant="caption" color="textSubtle">
                  {`Showing the latest ${SHOW} of ${records.length}.`}
                </AppText>
              ) : null}
            </Card>
          )}
          {hist.failure ? <LoadFailed failure={hist.failure} onRetry={hist.refresh} stale /> : null}
        </>
      )}
    </Screen>
  );
}

function TodayCard({ c, onOpen }: { c: TodayClass; onOpen: (start: boolean) => void }) {
  const t = useAppTheme();
  const a = c.todays;
  const times = classTimes(c.start, c.end);
  const v = a ? statusView(a.status, a.attendance_mode, c.teacher?.name ?? null) : null;
  return (
    <Card>
      <View style={{ gap: t.space.xs }}>
        <AppText variant="headline">{c.course}</AppText>
        <AppText variant="caption" color="textSubtle">
          {[c.group, times, c.teacher?.name].filter(Boolean).join(' · ')}
        </AppText>
        {!c.isToday && !a && c.classDays ? (
          <AppText variant="caption" color="textSubtle">
            {`Class days: ${c.classDays}`}
          </AppText>
        ) : null}
      </View>
      {a && v ? (
        <>
          <Notice tone={v.tone} title={`${a.attendance_mode === 'online' ? 'Marked in' : 'Checked in'} ${formatTime(a.check_in_time)}`}>
            {a.check_out_time ? `${v.text} · checked out ${formatTime(a.check_out_time)}` : v.text}
          </Notice>
          <Button title="Open check-in" variant="outline" onPress={() => onOpen(false)} />
        </>
      ) : c.open ? (
        <Button title="Check in" onPress={() => onOpen(true)} />
      ) : (
        <Notice tone="info">{c.note ?? 'Check-in is not open.'}</Notice>
      )}
    </Card>
  );
}

function Tile({ n, label }: { n: number; label: string }) {
  const t = useAppTheme();
  return (
    <View style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
      <AppText variant="title">{String(n ?? 0)}</AppText>
      <AppText variant="caption" color="textSubtle">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 2 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pill: { paddingHorizontal: 10, paddingVertical: 4 },
});
