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
import { useLayout } from '@/layout/useLayout';
import { mix, readableOn, tintedCard } from '@/theme/color';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  CARD_TINT,
  CARD_TINT_PRESSED,
  LEARN_API,
  countsLine,
  countsOf,
  courseSummary,
  daysLeftLine,
  initialOf,
  subjectChip,
  subjectColor,
  type Course,
  type MyGrades,
  type MyProgress,
  type Subject,
  type SubjectLessons,
} from './learn';
import { SubjectScreen } from './SubjectScreen';

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
  // iPad with room (the approved design): the open subject sits beside the list.
  const { split } = useLayout();
  const [openSubject, setOpenSubject] = useState<string | null>(null);
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
  // The subject open beside the list: the one chosen, else the one the
  // student is part-way through, else the first that is open to them.
  const usable = (subjects ?? []).filter((x) => !x.subject.frozen);
  const inProgress = usable.find((x) => subjectChip(x.subject, x.lessons?.lessons ?? null, x.lessons?.resume_lesson_id ?? null)?.tone === 'info');
  const openId = split ? (usable.some((x) => x.subject.id === openSubject) ? openSubject : ((inProgress ?? usable[0])?.subject.id ?? null)) : null;

  return (
    <Screen
      title="Learn"
      refreshing={refreshing || courses.refreshing}
      onRefresh={refresh}
      aside={split ? openId ? <SubjectScreen key={openId} subjectId={openId} embedded /> : <View /> : undefined}
    >
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
            // Vibrant (Yasir, 9 Nov 2026): the card is tinted with the
            // subject's colour, with a solid stripe, tile and bar in it. The
            // badge sits under the name, never beside it — beside it, a long
            // name broke mid-word ("Microsof t Word") on a phone with big text.
            const tint = subjectColor(s);
            const inks = [t.colors.text, t.colors.textMuted, t.colors.onDangerSoft];
            const card = tintedCard(t.colors.surface, tint, CARD_TINT[t.scheme], inks);
            const pressedCard = tintedCard(t.colors.surface, tint, CARD_TINT_PRESSED[t.scheme], inks);
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                disabled={s.frozen}
                accessibilityState={{ selected: openId === s.id }}
                onPress={() => (split ? setOpenSubject(s.id) : router.push({ pathname: '/student/learn/subject', params: { subject: s.id } }))}
                style={({ pressed }) => [
                  styles.subject,
                  {
                    backgroundColor: pressed ? pressedCard : card,
                    borderColor: openId === s.id ? tint : mix(card, tint, 0.55),
                    borderWidth: openId === s.id ? 2.5 : 1.5,
                    borderRadius: t.radius.xl,
                    opacity: s.frozen ? 0.6 : 1,
                  },
                ]}
              >
                <View style={[styles.stripe, { backgroundColor: tint }]} />
                <View style={[styles.tile, { backgroundColor: tint, borderRadius: t.radius.md }]}>
                  <AppText variant="title" style={{ color: readableOn(tint) }}>
                    {initialOf(s.name)}
                  </AppText>
                </View>
                <View style={[styles.flex, { gap: t.space.xs }]}>
                  <AppText variant="headline" numberOfLines={2}>
                    {s.name}
                  </AppText>
                  {chip ? <Pill text={chip.text} tone={chip.tone} /> : null}
                  <AppText variant="caption" color="textMuted">
                    {c ? countsLine(c) : `${s.lesson_count} lesson${s.lesson_count === 1 ? '' : 's'}`}
                  </AppText>
                  {left ? (
                    <AppText variant="caption" color={left.urgent ? 'onDangerSoft' : 'textMuted'}>
                      {left.text}
                    </AppText>
                  ) : null}
                  {c ? <Bar pct={pct} color={tint} track={mix(card, tint, 0.25)} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Screen>
  );
}

function Bar({ pct, color, track }: { pct: number; color?: string; track?: string }) {
  const t = useAppTheme();
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { backgroundColor: track ?? t.colors.surfaceMuted, borderRadius: t.radius.pill }]}>
      <View style={{ width: `${w}%`, height: '100%', backgroundColor: w >= 100 ? t.colors.success : (color ?? t.colors.primary), borderRadius: t.radius.pill }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 14, minHeight: minTouch },
  subject: { flexDirection: 'row', gap: 12, borderWidth: 1.5, padding: 14, paddingStart: 20, overflow: 'hidden' },
  stripe: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 6 },
  tile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, overflow: 'hidden', marginTop: 4 },
});
