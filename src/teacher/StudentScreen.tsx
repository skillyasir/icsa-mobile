import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { pathFor } from '@/api/paths';
import { formatDay, kd, statusWord } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  STATUS_TONE,
  STUDENTS_API,
  STUDENTS_HOME,
  attendanceLine,
  dialable,
  whatsappUrl,
  type AttendanceAnswer,
  type FeesAnswer,
  type StudentRow,
  type StudentsWho,
} from './students';

// One student, for the teacher (built 8 Nov 2026): call or WhatsApp, their
// courses and teachers, and their attendance — the AMS's own counts and rate.
// Opened only from the teacher's own list, which the AMS scopes to the
// students he teaches.

/** The iPad draws this beside the list (StudentsScreen's `aside`), with no back link. */
export function StudentScreen({ studentId, embedded = false, who = 'teacher' }: { studentId?: string; embedded?: boolean; who?: StudentsWho } = {}) {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = studentId ?? params.id;
  const live = !user?.preview && !!id;
  const one = useAmsGet<{ student: StudentRow }>(pathFor(STUDENTS_API.one.path, { id: id ?? '' }), live);
  const att = useAmsGet<AttendanceAnswer>(pathFor(STUDENTS_API.attendance.path, { id: id ?? '' }), live);
  // Reception sees the fees (the AMS's payment summary); a teacher's screen never asks.
  const reception = who === 'reception';
  const fees = useAmsGet<FeesAnswer>(pathFor(STUDENTS_API.fees.path, { student_id: id ?? '' }), live && reception);
  const s = one.data?.student ?? null;
  const tel = dialable(s?.phone);
  const wa = whatsappUrl(s?.whatsapp || s?.phone);

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace(STUDENTS_HOME[who]))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Students
      </AppText>
    </Pressable>
  );

  const refresh = () => {
    one.refresh();
    att.refresh();
    if (reception) fees.refresh();
  };

  return (
    <Screen
      title={s?.full_name ?? 'Student'}
      eyebrow={s?.student_code ?? undefined}
      top={embedded ? undefined : back}
      embedded={embedded}
      refreshing={one.refreshing || att.refreshing}
      onRefresh={refresh}
    >
      {one.loading && !s ? <Loading what="Loading the student…" /> : null}
      {one.failure ? <LoadFailed failure={one.failure} onRetry={refresh} stale={!!s} /> : null}

      {s ? (
        <Card>
          <View style={styles.row}>
            <AppText color="textMuted" style={styles.flex}>
              {[s.branch_name, s.last_present ? `Last attended ${formatDay(s.last_present)}` : 'Not attended yet'].filter(Boolean).join(' · ')}
            </AppText>
            {s.status ? <Pill text={s.status} tone={STATUS_TONE[s.status] ?? 'muted'} /> : null}
          </View>
          {s.phone ? <AppText variant="bodyStrong">{s.phone}</AppText> : <AppText color="textMuted">No phone number on file.</AppText>}
          <View style={styles.buttons}>
            {tel ? (
              <View style={styles.flex}>
                <Button title="Call" variant="outline" onPress={() => Linking.openURL(`tel:${tel}`)} />
              </View>
            ) : null}
            {wa ? (
              <View style={styles.flex}>
                <Button title="WhatsApp" variant="outline" onPress={() => Linking.openURL(wa)} />
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {s && reception ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            FEES
          </AppText>
          {fees.failure ? <LoadFailed failure={fees.failure} onRetry={fees.refresh} stale={!!fees.data} /> : null}
          {fees.data ? (
            <Card>
              <View style={styles.row}>
                <AppText variant="headline" style={styles.flex}>
                  Balance KD {kd(fees.data.balance_overall)}
                </AppText>
                <Pill text={Number(fees.data.balance_overall) > 0.0005 ? 'Owes' : 'Paid up'} tone={Number(fees.data.balance_overall) > 0.0005 ? 'warning' : 'success'} />
              </View>
              <AppText color="textMuted">Paid KD {kd(fees.data.total_paid_overall)}</AppText>
              {fees.data.enrollments.map((f, i) => (
                <View key={f.enrollment_id} style={[{ gap: 2 }, i === 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                  <AppText variant="bodyStrong">{f.course_name ?? 'Course'}</AppText>
                  <AppText variant="caption" color="textSubtle">
                    {[f.enrollment_no, `fee KD ${kd(f.net_amount)}`, `paid KD ${kd(f.total_paid)}`, `balance KD ${kd(f.balance)}`].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : fees.loading ? (
            <Loading what="Loading the fees…" />
          ) : null}
        </View>
      ) : null}

      {s && (s.enrollments ?? []).length > 0 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            COURSES
          </AppText>
          <Card>
            {(s.enrollments ?? []).map((e, i) => (
              <View key={e.id} style={[{ gap: 2 }, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                <View style={styles.row}>
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {e.course_name ?? 'Course'}
                  </AppText>
                  {e.status && e.status !== 'active' ? <Pill text={e.status.replace(/_/g, ' ')} tone="muted" /> : null}
                </View>
                <AppText variant="caption" color="textSubtle">
                  {[e.enrollment_no, e.teacher_name ? `Teacher ${e.teacher_name}` : null, e.enrolled_date ? `since ${formatDay(e.enrolled_date)}` : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {s ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            ATTENDANCE
          </AppText>
          {att.failure ? <LoadFailed failure={att.failure} onRetry={att.refresh} stale={!!att.data} /> : null}
          {att.data ? (
            <Card>
              <AppText variant="headline">{`${att.data.attendance_rate}% attendance`}</AppText>
              <AppText color="textMuted">{attendanceLine(att.data) || 'No classes recorded yet.'}</AppText>
              {att.data.records.slice(0, 10).map((r, i) => (
                <View key={r.id} style={[styles.row, i === 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                  <AppText variant="caption" color="textSubtle" style={styles.date}>
                    {formatDay(r.attendance_date)}
                  </AppText>
                  <AppText variant="caption" style={styles.flex} numberOfLines={1}>
                    {r.course_name ?? ''}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {statusWord(r.status)}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : att.loading ? (
            <Loading what="Loading attendance…" />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  date: { width: 92 },
});
