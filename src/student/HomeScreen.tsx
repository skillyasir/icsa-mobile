import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ATTENDANCE_API,
  checkInLabel,
  classTimes,
  feeTile,
  formatDay,
  formatTime,
  formatWeekdayDay,
  greeting,
  kuwaitDay,
  lessonPct,
  startsLabel,
  statusView,
} from '@/attendance/rules';
import { heroClass, todayClasses, type TodayClass } from '@/attendance/today';
import type { Dashboard, MyContext } from '@/attendance/types';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { Column, WideRow } from '@/components/WideRow';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

// The student's Home (Phase 2 piece 1, mockup 01, 6 Nov 2026): today's class
// and its Check in, then attended / progress / next fee, where to continue,
// and what is due. Every figure is the AMS's own (my-context and the student
// dashboard — the same endpoint as the website's Home), never added up here.
//
// Not shown, on purpose: the mockup's "You are 42 m from ICSA City" before
// checking in. That needs the location before the student taps Check in,
// and Yasir ruled (6 Nov 2026) the location is read only on that tap.

export function HomeScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const ctx = useAmsGet<MyContext>(ATTENDANCE_API.context.path, live);
  const dash = useAmsGet<Dashboard>(ATTENDANCE_API.dashboard.path, live);
  const [openedAt] = useState(() => new Date().toISOString());
  const now = ctx.data?.now ?? openedAt;
  const first = (user?.full_name ?? '').trim().split(/\s+/)[0] ?? '';

  const classes = todayClasses(ctx.data);
  const hero = heroClass(classes);
  const more = classes.filter((c) => c.isToday && c !== hero).length;
  const go = (c: TodayClass, start: boolean) =>
    router.push({ pathname: '/student/attendance/check-in', params: { enrollment: c.enrollmentId, ...(start ? { start: '1' } : {}) } });
  const refresh = () => {
    ctx.refresh();
    dash.refresh();
  };

  const d = dash.data;
  const resume = d?.courses.find((c) => c.resume_lesson_title && !c.frozen) ?? null;
  const progressOf = resume ?? d?.courses.find((c) => !c.frozen) ?? null;
  const fee = feeTile(d?.payments.next_due, ctx.data?.today ?? kuwaitDay(now));

  return (
    <Screen
      title={first ? `${greeting(now)}, ${first}` : greeting(now)}
      eyebrow={formatWeekdayDay(now)}
      refreshing={ctx.refreshing || dash.refreshing}
      onRefresh={live ? refresh : undefined}
      width="full"
    >
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so Home has nothing to load.
        </Notice>
      ) : null}

      {live && ctx.loading && !ctx.data ? <Loading what="Loading today’s class…" /> : null}
      {live && ctx.failure && !ctx.data ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} /> : null}
      {ctx.data ? (
        hero ? (
          <HeroCard c={hero} now={now} branch={user?.branch_name ?? null} more={more} onGo={go} />
        ) : (
          <Card>
            <AppText variant="headline">No class today</AppText>
            <AppText color="textMuted">On a class day, you check in here.</AppText>
          </Card>
        )
      ) : null}

      {live && dash.failure && !dash.data ? <LoadFailed failure={dash.failure} onRetry={dash.refresh} /> : null}
      {live && (d || dash.loading) ? (
        <View style={styles.tiles}>
          <Tile
            label="Attended"
            value={d ? String(d.attendance.present) : '—'}
            sub={d ? `of ${d.attendance.total} sessions` : ''}
          />
          <Tile
            label="Progress"
            value={progressOf ? `${lessonPct(progressOf.lessons_done, progressOf.lessons_total)}%` : '—'}
            sub={progressOf ? `${Number(progressOf.lessons_done) || 0} of ${Number(progressOf.lessons_total) || 0} lessons` : ''}
            bar={progressOf ? lessonPct(progressOf.lessons_done, progressOf.lessons_total) : null}
          />
          <Tile label={fee.label} value={d ? fee.value : '—'} sub={d ? fee.sub : ''} alert={!!d && fee.overdue} />
        </View>
      ) : null}

      {/* iPad: where to continue beside what is due (the approved design). */}
      <WideRow ratios={[2, 1]}>
      <Column>
      {resume ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            CONTINUE LEARNING
          </AppText>
          <Pressable
            accessibilityRole="button"
            disabled={!resume.resume_subject_id}
            onPress={() =>
              resume.resume_subject_id &&
              router.push(
                resume.resume_lesson_id
                  ? { pathname: '/student/learn/open', params: { subject: resume.resume_subject_id, item: resume.resume_lesson_id, title: resume.resume_lesson_title ?? '' } }
                  : { pathname: '/student/learn/subject', params: { subject: resume.resume_subject_id } },
              )
            }
            style={({ pressed }) => pressed && { opacity: 0.7 }}
          >
            <Card>
              <AppText variant="caption" color="textSubtle">
                {[resume.name, resume.resume_subject_name].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="headline">{resume.resume_lesson_title}</AppText>
              <Bar pct={lessonPct(resume.lessons_done, resume.lessons_total)} />
            </Card>
          </Pressable>
        </View>
      ) : null}
      </Column>
      <Column>
      {d && d.due_soon.length > 0 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            DUE SOON
          </AppText>
          <Card>
            {d.due_soon.slice(0, 3).map((x, i) => (
              <Pressable
                key={x.kind + x.id}
                accessibilityRole="button"
                disabled={x.kind !== 'assignment'}
                onPress={() => router.push({ pathname: '/student/learn/assignment', params: { id: x.id } })}
                style={[styles.due, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}
              >
                <View style={[styles.chip, { backgroundColor: t.colors.warningSoft, borderRadius: t.radius.sm }]}>
                  <AppText variant="label" color="onWarningSoft">
                    {formatDay(x.due_date) || 'No date'}
                  </AppText>
                </View>
                <AppText style={styles.flex} numberOfLines={2}>
                  {`${x.kind === 'assignment' ? 'Assignment' : 'Quiz'} — ${x.title}`}
                </AppText>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : null}
      </Column>
      </WideRow>
    </Screen>
  );
}

function HeroCard({
  c,
  now,
  branch,
  more,
  onGo,
}: {
  c: TodayClass;
  now: string;
  branch: string | null;
  more: number;
  onGo: (c: TodayClass, start: boolean) => void;
}) {
  const t = useAppTheme();
  const a = c.todays;
  const soon = a ? '' : startsLabel(c.start, c.end, now);
  const place = c.mode === 'online' ? 'Online' : c.mode === 'hybrid' ? 'Branch or online' : branch;
  const v = a ? statusView(a.status, a.attendance_mode, c.teacher?.name ?? null) : null;
  return (
    <View style={[styles.hero, { backgroundColor: t.colors.hero, borderRadius: t.radius.xl, padding: t.space.lg, gap: t.space.md }]}>
      <View style={styles.heroTop}>
        <AppText variant="label" color="onHeroMuted">
          {c.isToday ? 'YOUR CLASS TODAY' : 'YOUR CLASS'}
        </AppText>
        {soon ? (
          <View style={[styles.soon, { backgroundColor: t.colors.onHero + '26', borderRadius: t.radius.pill }]}>
            <AppText variant="label" color="onHero">
              {soon}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ gap: t.space.xs }}>
        <AppText variant="title" color="onHero">
          {c.course}
        </AppText>
        <AppText variant="caption" color="onHeroMuted">
          {[classTimes(c.start, c.end), place, c.teacher?.name].filter(Boolean).join(' · ')}
        </AppText>
        {!c.isToday && c.classDays ? (
          <AppText variant="caption" color="onHeroMuted">
            {`Your class days: ${c.classDays}`}
          </AppText>
        ) : null}
      </View>
      {a && v ? (
        <>
          <AppText variant="bodyStrong" color="onHero">
            {`${a.attendance_mode === 'online' ? 'Marked in' : 'Checked in'} at ${formatTime(a.check_in_time)} — ${
              a.check_out_time ? `checked out at ${formatTime(a.check_out_time)}` : v.text
            }`}
          </AppText>
          <Button title="Open check-in" variant="outline" onPress={() => onGo(c, false)} />
        </>
      ) : c.open ? (
        <Button title={checkInLabel(c.mode)} variant="attention" onPress={() => onGo(c, true)} />
      ) : (
        <AppText variant="bodyStrong" color="onHero">
          {c.note ?? 'Check-in is not open.'}
        </AppText>
      )}
      {more > 0 ? (
        <AppText variant="caption" color="onHeroMuted">
          {`${more} more ${more === 1 ? 'class' : 'classes'} today — see Attendance.`}
        </AppText>
      ) : null}
    </View>
  );
}

function Tile({
  label,
  value,
  sub,
  bar = null,
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  bar?: number | null;
  alert?: boolean;
}) {
  const t = useAppTheme();
  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: alert ? t.colors.dangerSoft : t.colors.surface,
          borderColor: t.colors.border,
          borderRadius: t.radius.lg,
        },
      ]}
    >
      <AppText variant="caption" color={alert ? 'onDangerSoft' : 'textSubtle'}>
        {label}
      </AppText>
      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {bar !== null ? <Bar pct={bar} /> : null}
      {sub ? (
        <AppText variant="caption" color="textSubtle" numberOfLines={2}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}

function Bar({ pct }: { pct: number }) {
  const t = useAppTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderColor: t.colors.border }]}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: t.colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {},
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  soon: { paddingHorizontal: 10, paddingVertical: 4 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderWidth: 1, padding: 12, gap: 4 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { height: '100%' },
  due: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { paddingHorizontal: 8, paddingVertical: 4 },
});
