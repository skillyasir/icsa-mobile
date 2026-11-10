import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { formatDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { openAmsFile } from '@/files/openAmsFile';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { ASSIGNMENT_API, SUBMISSION_WORD, fileName, reviewBody, rowsOf, type Outcome, type SubmissionsAnswer } from './assignments';
import { pathFor } from './today';

// Review one submission (mockup 07's sheet, as its own screen): open the file,
// a score out of the assignment's marks, a comment to the student, then
// Return to redo or Mark reviewed — the AMS's needs_revision and approved.

/**
 * The iPad draws this beside the list (AssignmentsScreen's `aside`): the ids
 * come as props, there is no back link, and a sent review calls `onDone` (the
 * list reloads and opens the next) instead of going back. A phone opens it as
 * its own screen from the route, as before.
 */
export function ReviewScreen({
  assignmentId,
  submissionId,
  embedded = false,
  onDone,
}: { assignmentId?: string; submissionId?: string; embedded?: boolean; onDone?: () => void } = {}) {
  const params = useLocalSearchParams<{ assignment?: string; submission?: string }>();
  const assignment = assignmentId ?? params.assignment;
  const submission = submissionId ?? params.submission;
  const router = useRouter();
  const t = useAppTheme();
  const { user } = useSession();
  const data = useAmsGet<SubmissionsAnswer>(pathFor(ASSIGNMENT_API.submissions.path, { id: assignment ?? '' }), !user?.preview && !!assignment);
  const row = data.data ? (rowsOf([data.data]).find((r) => r.id === submission) ?? null) : null;

  const [score, setScore] = useState<string | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const [busy, setBusy] = useState<Outcome | 'file' | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  const scoreText = score ?? (row?.grade != null ? String(Number(row.grade)) : '');
  const commentText = comment ?? row?.feedback ?? '';

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/teacher/assignments'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Check assignments
      </AppText>
    </Pressable>
  );

  if (!row) {
    return (
      <Screen title="Review" top={embedded ? undefined : back} embedded={embedded}>
        {data.loading ? <Loading what="Loading the submission…" /> : null}
        {data.failure ? <LoadFailed failure={data.failure} onRetry={data.refresh} /> : null}
        {data.data ? (
          <Card>
            <AppText color="textMuted">This submission is no longer in the list.</AppText>
          </Card>
        ) : null}
      </Screen>
    );
  }

  const open = async () => {
    if (!row.file_url) return;
    setBusy('file');
    const err = await openAmsFile(row.file_url, fileName(row.file_url));
    if (err) setMessage({ tone: 'danger', text: err });
    setBusy(null);
  };

  const send = async (outcome: Outcome) => {
    setMessage(null);
    const b = reviewBody(outcome, scoreText, commentText, row.max_points);
    if (!b.ok) {
      setMessage({ tone: 'danger', text: b.message });
      return;
    }
    setBusy(outcome);
    try {
      const res = await ams.request('POST', pathFor(ASSIGNMENT_API.review.path, { submissionId: row.id }), b.body);
      if (!res.ok) {
        setMessage({ tone: 'danger', text: res.failure.message });
        return;
      }
      if (onDone) onDone();
      else router.back();
    } catch (err) {
      console.warn('[review] could not send:', err instanceof Error ? err.message : String(err));
      setMessage({ tone: 'danger', text: 'The review could not be sent. Nothing was saved — try again.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title={`Review — ${row.student_name}`}
      eyebrow={`${row.title} · submitted ${formatDay(row.submitted_at)}`}
      top={embedded ? undefined : back}
      embedded={embedded}
    >
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <Card>
        {row.file_url ? (
          <View style={styles.file}>
            <AppText variant="bodyStrong" style={styles.flex} numberOfLines={2}>
              {fileName(row.file_url)}
            </AppText>
            <Pressable accessibilityRole="button" onPress={open} disabled={busy !== null} hitSlop={10}>
              <AppText variant="bodyStrong" color="link">
                {busy === 'file' ? 'Opening…' : 'Open'}
              </AppText>
            </Pressable>
          </View>
        ) : (
          <AppText color="textMuted">No file was attached.</AppText>
        )}
        <AppText variant="caption" color="textSubtle">
          {`${row.subject_name} · ${row.course_name} · now ${SUBMISSION_WORD[row.status] ?? row.status}`}
        </AppText>
      </Card>

      {row.can_grade ? (
        <View style={{ gap: t.space.md }}>
          <TextField
            label={row.max_points != null ? `Score out of ${row.max_points}` : 'Score'}
            value={scoreText}
            onChangeText={setScore}
            keyboardType="decimal-pad"
            placeholder="Leave empty for no score"
          />
          <TextField
            label="Comment to the student"
            value={commentText}
            onChangeText={setComment}
            multiline
            style={styles.comment}
            placeholder="What was good, and what to change"
          />
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button title="Return to redo" variant="outline" busy={busy === 'needs_revision'} disabled={busy !== null} onPress={() => send('needs_revision')} />
            </View>
            <View style={styles.flex}>
              <Button title="Mark reviewed" variant="success" busy={busy === 'approved'} disabled={busy !== null} onPress={() => send('approved')} />
            </View>
          </View>
        </View>
      ) : (
        <Notice tone="info">You can see this submission, but marking it is for the course&apos;s teacher.</Notice>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  file: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  comment: { minHeight: 110, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: 10 },
});
