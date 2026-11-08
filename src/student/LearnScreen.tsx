import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import type { Failure } from '@/api/session';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  LEARN_API,
  countsLine,
  countsOf,
  courseSummary,
  daysLeftLine,
  initialOf,
  subjectChip,
  type Course,
  type MyGrades,
  type MyProgress,
  type Subject,
  type SubjectLessons,
} from './learn';

// The student's Learn tab (mockup 03, built 8 Nov 2026): the course, its
// progress and grade so far (the AMS's figures), and its subjects — each with
// where the student is. Tap a subject for its lessons, quizzes and assignments.

type Loaded = { subject: Subject; lessons: SubjectLessons | null };

export function LearnScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const courses = useAmsGet<{ courses: Course[] }>(LEARN_API.courses.path, live);
  const progress = useAmsGet<MyProgress>(LEARN_API.progress.path, live);
  const grades = useAmsGet<MyGrades>(LEARN_API.grades.path, live);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [subjects, setSubjects] = useState<Loaded[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const list = courses.data?.courses ?? [];
  const course = list.find((c) => c.id === chosen) ?? list.find((c) => !c.frozen) ?? list[0] ?? null;
  const courseId = course?.id ?? null;

  // The subjects, then each one's list — a course has a handful.
  const load = useCallback(
    async (pull: boolean) => {
      if (!live || !courseId) return;
      const mine = ++latest.current;
      if (pull) setRefreshing(true);
      const s = await ams.request<{ subjects: Subject[] }>('GET', pathFor(LEARN_API.subjects.path, { courseId }));
      if (!s.ok) {
        if (mine === latest.current) {
          setFailure(s.failure);
          setRefreshing(false);
        }
        return;
      }
      const loaded = await Promise.all(
        s.value.subjects.map(async (subject): Promise<Loaded> => {
          if (subject.frozen) return { subject, lessons: null };
          const r = await ams.request<SubjectLessons>('GET', pathFor(LEARN_API.items.path, { subjectId: subject.id }));
          return { subject, lessons: r.ok ? r.value : null };
        }),
      );
      if (mine !== latest.current) return;
      setSubjects(loaded);
      setFailure(null);
      setRefreshing(false);
    },
    [live, courseId],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const refresh = () => {
    courses.refresh();
    progress.refresh();
    grades.refresh();
    load(true);
  };

  if (!live) {
    return (
      <Screen title="Learn">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no courses to show.
        </Notice>
      </Screen>
    );
  }

  const summary = courseId ? courseSummary(courseId, progress.data, grades.data) : null;

  return (
    <Screen title="Learn" refreshing={refreshing || courses.refreshing} onRefresh={refresh}>
      {courses.loading && !courses.data ? <Loading what="Loading your courses…" /> : null}
      {courses.failure && !courses.data ? <LoadFailed failure={courses.failure} onRetry={courses.refresh} /> : null}
      {courses.data && list.length === 0 ? (
        <Card>
          <AppText variant="bodyStrong">No course content yet</AppText>
          <AppText color="textMuted">Your teacher gives you access to each subject when it starts.</AppText>
        </Card>
      ) : null}

      {course ? (
        <View style={{ gap: t.space.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Course: ${course.name}${list.length > 1 ? '. Change course' : ''}`}
            disabled={list.length < 2}
            onPress={() => setPicking((p) => !p)}
            style={[styles.picker, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}
          >
            <AppText variant="headline" style={styles.flex} numberOfLines={2}>
              {course.name}
            </AppText>
            {course.frozen ? <Pill text="Paused" tone="muted" /> : null}
            {list.length > 1 ? (
              <AppText variant="headline" color="textMuted">
                {picking ? '⌃' : '⌄'}
              </AppText>
            ) : null}
          </Pressable>
          {picking
            ? list
                .filter((c) => c.id !== course.id)
                .map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    onPress={() => {
                      setChosen(c.id);
                      setPicking(false);
                      setSubjects(null);
                    }}
                    style={[styles.picker, { backgroundColor: t.colors.surfaceMuted, borderColor: t.colors.border, borderRadius: t.radius.lg }]}
                  >
                    <AppText style={styles.flex}>{c.name}</AppText>
                    {c.frozen ? <Pill text="Paused" tone="muted" /> : null}
                  </Pressable>
                ))
            : null}
        </View>
      ) : null}

      {summary ? (
        <Card>
          <View style={styles.row}>
            <AppText variant="title" color="link">{`${summary.pct}%`}</AppText>
            <AppText color="textMuted" style={styles.flex}>
              {summary.line}
            </AppText>
          </View>
          <Bar pct={summary.pct} />
        </Card>
      ) : null}

      {course?.frozen ? (
        <Notice tone="info" title="This course is paused">
          Your enrolment is on a break. The subjects open again when it resumes.
        </Notice>
      ) : null}

      {course && !course.frozen ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            SUBJECTS
          </AppText>
          {subjects === null && !failure ? <Loading what="Loading the subjects…" /> : null}
          {failure ? <LoadFailed failure={failure} onRetry={() => load(true)} stale={subjects !== null} /> : null}
          {subjects !== null && subjects.length === 0 ? (
            <Card>
              <AppText color="textMuted">No subjects are open to you in this course yet.</AppText>
            </Card>
          ) : null}
          {(subjects ?? []).map(({ subject: s, lessons }) => {
            const items = lessons?.lessons ?? null;
            const c = items ? countsOf(items) : null;
            const chip = subjectChip(s, items, lessons?.resume_lesson_id ?? null);
            const left = daysLeftLine(s.days_left);
            const pct = c && c.lessons.total ? Math.round((c.lessons.done / c.lessons.total) * 100) : 0;
            const tint = /^#[0-9a-f]{6}$/i.test(s.color ?? '') ? (s.color as string) : t.colors.primary;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                disabled={s.frozen}
                onPress={() => router.push({ pathname: '/student/learn/subject', params: { subject: s.id } })}
                style={({ pressed }) => [
                  styles.subject,
                  {
                    backgroundColor: pressed ? t.colors.surfaceMuted : t.colors.surface,
                    borderColor: chip?.tone === 'info' ? t.colors.primary : t.colors.border,
                    borderRadius: t.radius.xl,
                    opacity: s.frozen ? 0.6 : 1,
                  },
                ]}
              >
                <View style={[styles.tile, { backgroundColor: tint + '22', borderRadius: t.radius.md }]}>
                  <AppText variant="title" style={{ color: tint }}>
                    {initialOf(s.name)}
                  </AppText>
                </View>
                <View style={[styles.flex, { gap: t.space.xs }]}>
                  <View style={styles.row}>
                    <AppText variant="headline" style={styles.flex} numberOfLines={2}>
                      {s.name}
                    </AppText>
                    {chip ? <Pill text={chip.text} tone={chip.tone} /> : null}
                  </View>
                  <AppText variant="caption" color="textSubtle">
                    {c ? countsLine(c) : `${s.lesson_count} lesson${s.lesson_count === 1 ? '' : 's'}`}
                  </AppText>
                  {left ? (
                    <AppText variant="caption" color={left.urgent ? 'onDangerSoft' : 'textSubtle'}>
                      {left.text}
                    </AppText>
                  ) : null}
                  {c ? <Bar pct={pct} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function Bar({ pct }: { pct: number }) {
  const t = useAppTheme();
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.pill }]}>
      <View style={{ width: `${w}%`, height: '100%', backgroundColor: w >= 100 ? t.colors.success : t.colors.primary, borderRadius: t.radius.pill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 14, minHeight: minTouch },
  subject: { flexDirection: 'row', gap: 12, borderWidth: 1.5, padding: 14 },
  tile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, overflow: 'hidden' },
});
