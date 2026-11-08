import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { pathFor } from '@/api/paths';
import { formatDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import type { Palette } from '@/theme/tokens';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { LEARN_API, chaptersOf, lineOf, type Line, type SubjectLessons } from './learn';

// One subject (built 8 Nov 2026): its chapters, and in each the lessons,
// quizzes and assignments in the teacher's order, with where the student is.
// An assignment opens in the app's own screen; a lesson or a quiz opens as the
// website's own page (Yasir ruled, 8 Nov 2026 — LessonWebScreen).

const MARK: Record<Line['kind'], { glyph: string; bg: keyof Palette; fg: keyof Palette }> = {
  lesson: { glyph: '○', bg: 'surfaceMuted', fg: 'textMuted' },
  quiz: { glyph: '✦', bg: 'infoSoft', fg: 'onInfoSoft' },
  final: { glyph: '★', bg: 'infoSoft', fg: 'onInfoSoft' },
  assignment: { glyph: '✎', bg: 'warningSoft', fg: 'onWarningSoft' },
};

export function SubjectScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const { subject } = useLocalSearchParams<{ subject?: string }>();
  const data = useAmsGet<SubjectLessons>(pathFor(LEARN_API.items.path, { subjectId: subject ?? '' }), !user?.preview && !!subject);
  const d = data.data;
  const chapters = d ? chaptersOf(d.lessons) : [];
  const pct = d && d.progress.total ? Math.round((d.progress.completed / d.progress.total) * 100) : 0;

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/learn'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Learn
      </AppText>
    </Pressable>
  );

  return (
    <Screen title={d?.subject.subject_name ?? 'Subject'} eyebrow={d?.subject.course_name} top={back} refreshing={data.refreshing} onRefresh={data.refresh}>
      {data.loading && !d ? <Loading what="Loading the subject…" /> : null}
      {data.failure ? <LoadFailed failure={data.failure} onRetry={data.refresh} stale={!!d} /> : null}

      {d ? (
        <Card>
          <AppText color="textMuted">{`${d.progress.completed} of ${d.progress.total} lessons done`}</AppText>
          <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.pill }]}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: pct >= 100 ? t.colors.success : t.colors.primary, borderRadius: t.radius.pill }} />
          </View>
        </Card>
      ) : null}

      {d && chapters.length === 0 ? (
        <Card>
          <AppText color="textMuted">Nothing has been published in this subject yet.</AppText>
        </Card>
      ) : null}

      {chapters.map((ch) => (
        <View key={ch.id} style={{ gap: t.space.sm }}>
          {ch.title ? (
            <AppText variant="label" color="textMuted">
              {ch.title.toUpperCase()}
            </AppText>
          ) : null}
          <View style={[styles.list, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
            {ch.items.map((it, i) => {
              const l = lineOf(it, formatDay);
              const m = l.done && l.kind === 'lesson' ? { glyph: '✓', bg: 'successSoft' as const, fg: 'onSuccessSoft' as const } : MARK[l.kind];
              const glyph = l.kind === 'final' && it.final_exam?.locked ? '🔒' : m.glyph;
              const row = (
                <>
                  <View style={[styles.mark, { backgroundColor: t.colors[m.bg] }]}>
                    <AppText variant="bodyStrong" color={m.fg}>
                      {glyph}
                    </AppText>
                  </View>
                  <View style={[styles.flex, { gap: 2 }]}>
                    <AppText variant="bodyStrong" numberOfLines={2}>
                      {l.title}
                    </AppText>
                    {l.sub ? (
                      <AppText variant="caption" color="textSubtle">
                        {l.sub}
                      </AppText>
                    ) : null}
                  </View>
                  {l.badge ? <Pill text={l.badge.text} tone={l.badge.tone} /> : null}
                  <AppText variant="headline" color="textMuted">
                    ›
                  </AppText>
                </>
              );
              const style = [styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border }];
              return (
                <Pressable
                  key={it.id}
                  accessibilityRole="button"
                  onPress={() =>
                    l.opens === 'assignment'
                      ? router.push({ pathname: '/student/learn/assignment', params: { id: it.id } })
                      : router.push({ pathname: '/student/learn/open', params: { subject: subject ?? '', item: it.id, title: l.title } })
                  }
                  style={({ pressed }) => [...style, pressed && { backgroundColor: t.colors.surfaceMuted }]}
                >
                  {row}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  track: { height: 6, overflow: 'hidden' },
  list: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: minTouch },
  mark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
