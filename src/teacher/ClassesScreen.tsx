import { StyleSheet, View } from 'react-native';

import { formatDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import type { Palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { CLASSES_API, classChips, classTitle, quizLine, stuckLine, type MyClasses } from './classes';

// The teacher's Classes (built 7 Nov 2026): who needs him first — stuck,
// failing a quiz, waiting to be marked, not started — then each class with its
// progress. All of it is GET /progress/my-classes, the AMS's own figures.

const TONE: Record<string, { bg: keyof Palette; fg: keyof Palette }> = {
  danger: { bg: 'dangerSoft', fg: 'onDangerSoft' },
  warning: { bg: 'warningSoft', fg: 'onWarningSoft' },
  success: { bg: 'successSoft', fg: 'onSuccessSoft' },
  info: { bg: 'infoSoft', fg: 'onInfoSoft' },
};
const SHOW = 6;

export function ClassesScreen() {
  const t = useAppTheme();
  const { user } = useSession();
  const live = !user?.preview;
  const mc = useAmsGet<MyClasses>(CLASSES_API.myClasses.path, live);
  const d = mc.data;

  if (!live) {
    return (
      <Screen title="Classes">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no classes to show.
        </Notice>
      </Screen>
    );
  }

  const sections: { key: string; title: string; lines: { name: string; sub: string; line: string }[] }[] = d
    ? [
        { key: 'stuck', title: 'STUCK', lines: d.needs.stuck.map((s) => ({ name: s.student_name, sub: s.subject_name, line: stuckLine(s) })) },
        { key: 'quiz', title: 'FAILING A QUIZ', lines: d.needs.quiz.map((q) => ({ name: q.student_name, sub: q.subject_name, line: quizLine(q) })) },
        { key: 'mark', title: 'TO MARK', lines: d.needs.to_mark.map((m) => ({ name: m.student_name, sub: m.subject_name, line: m.title + (m.submitted_at ? ` · ${formatDay(m.submitted_at)}` : '') })) },
        { key: 'never', title: 'NOT STARTED', lines: d.needs.not_started.map((n) => ({ name: n.student_name, sub: n.subject_name, line: n.since ? `Has had access since ${formatDay(n.since)}` : 'Has access, nothing done yet' })) },
      ].filter((s) => s.lines.length > 0)
    : [];

  return (
    <Screen
      title="Classes"
      eyebrow={d ? `${d.students} ${d.students === 1 ? 'student' : 'students'} · this week ${d.week.lessons} lessons, ${d.week.quizzes} quizzes, ${d.week.assignments} assignments done` : undefined}
      refreshing={mc.refreshing}
      onRefresh={mc.refresh}
    >
      {mc.loading && !d ? <Loading what="Loading your classes…" /> : null}
      {mc.failure ? <LoadFailed failure={mc.failure} onRetry={mc.refresh} stale={!!d} /> : null}

      {d && sections.length === 0 ? (
        <Card>
          <AppText variant="headline">Nobody needs you right now</AppText>
          <AppText color="textMuted">No one is stuck, failing a quiz, waiting to be marked or not started.</AppText>
        </Card>
      ) : null}

      {sections.map((s) => (
        <View key={s.key} style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            {`${s.title} · ${s.lines.length}`}
          </AppText>
          <Card>
            {s.lines.slice(0, SHOW).map((l, i) => (
              <View key={i} style={[i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                <AppText variant="bodyStrong">{l.name}</AppText>
                <AppText variant="caption" color="textSubtle">
                  {`${l.sub} · ${l.line}`}
                </AppText>
              </View>
            ))}
            {s.lines.length > SHOW ? (
              <AppText variant="caption" color="textSubtle">
                {`and ${s.lines.length - SHOW} more — the full list is on My classes in the AMS`}
              </AppText>
            ) : null}
          </Card>
        </View>
      ))}

      {d ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="headline">Your classes</AppText>
          {d.classes.length === 0 ? (
            <Card>
              <AppText color="textMuted">No classes with students yet.</AppText>
            </Card>
          ) : (
            d.classes.map((c) => {
              const head = classTitle(c);
              const pct = c.avg_pct != null ? Math.round(Number(c.avg_pct)) : null;
              return (
                <Card key={c.subject_id}>
                  <View style={styles.head}>
                    <View style={styles.flex}>
                      <AppText variant="headline">{head.title}</AppText>
                      <AppText variant="caption" color="textSubtle">
                        {head.sub}
                      </AppText>
                    </View>
                    {pct != null ? <AppText variant="title">{`${pct}%`}</AppText> : null}
                  </View>
                  {pct != null ? (
                    <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderColor: t.colors.border }]}>
                      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: t.colors.primary }]} />
                    </View>
                  ) : null}
                  <View style={styles.chips}>
                    {classChips(c).map((ch) => (
                      <View key={ch.key} style={[styles.chip, { backgroundColor: t.colors[TONE[ch.tone].bg], borderRadius: t.radius.pill }]}>
                        <AppText variant="label" color={TONE[ch.tone].fg}>
                          {ch.text}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { height: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4 },
});
