import { File, UploadType } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { failureOfAnswer, MESSAGES } from '@/api/session';
import { formatDay, formatTime } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { AMS_API_URL } from '@/config';
import { openAmsFile } from '@/files/openAmsFile';
import { useSession } from '@/session/SessionContext';
import { fitWithin } from '@/student/fees';
import { fileName } from '@/teacher/assignments';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  PHOTO_MAX_DIM,
  PHOTO_QUALITY,
  PICKER_TYPES,
  STUDENT_ASSIGNMENT_API,
  UPLOAD_FIELD,
  briefText,
  canHandIn,
  commentAuthor,
  fileProblem,
  gradeLine,
  handInLabel,
  typeOf,
  uploadedUrl,
  type Comment,
  type MyAssignment,
} from './assignment';
import { SUBMISSION_STATUS } from './learn';

// One assignment for the student (built 8 Nov 2026): the brief, their work,
// the teacher's grade and comment, handing in a file or a photo, and the
// comment thread. Handing in is two steps, as on the website: the file goes
// to the AMS's upload, then the hand-in names it. Sent once per tap with a
// live connection — never queued — by expo-file-system's upload (fees.check
// §6 says why not fetch + FormData).

const UPLOAD_TIMEOUT_MS = 120_000;

type Picked = { uri: string; name: string; size: number | null; type: string };

export function AssignmentScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const live = !user?.preview && !!id;
  const data = useAmsGet<MyAssignment>(pathFor(STUDENT_ASSIGNMENT_API.one.path, { id: id ?? '' }), live);
  const a = data.data?.assignment ?? null;
  const sub = data.data?.submission ?? null;
  const comments = useAmsGet<{ comments: Comment[] }>(
    pathFor(STUDENT_ASSIGNMENT_API.comments.path, { submissionId: sub?.id ?? '' }),
    live && !!sub?.id,
  );
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState<'pick' | 'send' | 'open' | 'comment' | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [reply, setReply] = useState('');

  const pickPhoto = async (camera: boolean) => {
    setMessage(null);
    setBusy('pick');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setMessage({ tone: 'danger', text: 'The camera is off for ICSA. Allow it in Settings, or choose a photo instead.' });
      }
      const r = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (r.canceled || !r.assets?.[0]) return;
      const p = r.assets[0];
      // Every photo is sent as a JPEG, sharp enough for a teacher to read.
      const ctx = ImageManipulator.manipulate(p.uri);
      const size = fitWithin(p.width, p.height, PHOTO_MAX_DIM);
      if (size.width !== p.width || size.height !== p.height) ctx.resize(size);
      const out = await (await ctx.renderAsync()).saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
      const f = new File(out.uri);
      setPicked({ uri: out.uri, name: 'photo.jpg', size: f.size, type: 'image/jpeg' });
    } catch (err) {
      console.warn('[assignment] the photo failed:', err instanceof Error ? err.message : String(err));
      setMessage({ tone: 'danger', text: 'The photo could not be prepared. Try another one.' });
    } finally {
      setBusy(null);
    }
  };

  const pickFile = async () => {
    setMessage(null);
    setBusy('pick');
    try {
      const r = await File.pickFileAsync({ mimeTypes: PICKER_TYPES });
      if (r.canceled || !r.result) return;
      const f = r.result;
      const problem = fileProblem({ name: f.name, size: f.size });
      if (problem) return setMessage({ tone: 'danger', text: problem });
      setPicked({ uri: f.uri, name: f.name, size: f.size, type: typeOf(f.name) as string });
    } catch (err) {
      console.warn('[assignment] picking a file failed:', err instanceof Error ? err.message : String(err));
      setMessage({ tone: 'danger', text: 'The file could not be opened. Try another one.' });
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!picked || !a) return;
    setMessage(null);
    setBusy('send');
    try {
      const tok = await ams.token();
      if (!tok.ok) return setMessage({ tone: 'danger', text: tok.failure.message });
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
      let up: { status: number; body: string };
      try {
        up = await new File(picked.uri).upload(AMS_API_URL + STUDENT_ASSIGNMENT_API.upload.path, {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: UPLOAD_FIELD,
          mimeType: picked.type,
          headers: { Authorization: `Bearer ${tok.value}`, Accept: 'application/json' },
          sessionType: 'foreground',
          signal: ac.signal,
        });
      } catch (err) {
        console.warn('[assignment] the upload failed:', err instanceof Error ? err.message : String(err));
        return setMessage({ tone: 'danger', text: MESSAGES.offline });
      } finally {
        clearTimeout(timer);
      }
      if (up.status < 200 || up.status >= 300) {
        let json: Record<string, unknown> = {};
        try {
          json = JSON.parse(up.body) as Record<string, unknown>;
        } catch {
          // not JSON: the status decides
        }
        return setMessage({ tone: 'danger', text: failureOfAnswer(up.status, json).message });
      }
      const url = uploadedUrl(up.body);
      if (!url) return setMessage({ tone: 'danger', text: 'The file was not accepted. Nothing was handed in — try again.' });
      const r = await ams.request('POST', pathFor(STUDENT_ASSIGNMENT_API.submit.path, { id: a.id }), { file_url: url });
      if (!r.ok) return setMessage({ tone: 'danger', text: `${r.failure.message} Nothing was handed in.` });
      setPicked(null);
      setMessage({ tone: 'success', text: 'Handed in. Your teacher will review it.' });
      data.refresh();
    } catch (err) {
      console.warn('[assignment] hand-in failed:', err instanceof Error ? err.message : String(err));
      setMessage({ tone: 'danger', text: 'It could not be handed in. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  const confirmSend = () => {
    if (!sub) return send();
    Alert.alert('Resubmit?', 'Your new file replaces the one you handed in, and your teacher reviews it again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resubmit', onPress: () => send() },
    ]);
  };

  const open = async (url: string, name: string) => {
    setBusy('open');
    const err = await openAmsFile(url, name);
    setBusy(null);
    if (err) setMessage({ tone: 'danger', text: err });
  };

  const postComment = async () => {
    if (!sub || !reply.trim()) return;
    setBusy('comment');
    const r = await ams.request('POST', pathFor(STUDENT_ASSIGNMENT_API.comment.path, { submissionId: sub.id }), { body: reply.trim() });
    setBusy(null);
    if (!r.ok) return setMessage({ tone: 'danger', text: r.failure.message });
    setReply('');
    comments.refresh();
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/learn'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Back
      </AppText>
    </Pressable>
  );

  const status = sub ? (SUBMISSION_STATUS[sub.status] ?? { text: sub.status, tone: 'muted' as const }) : null;
  const grade = sub ? gradeLine(sub.grade, a?.max_points) : null;
  const brief = briefText(a?.brief);

  return (
    <Screen title={a?.title ?? 'Assignment'} top={back} refreshing={data.refreshing} onRefresh={data.refresh}>
      {data.loading && !data.data ? <Loading what="Loading the assignment…" /> : null}
      {data.failure ? <LoadFailed failure={data.failure} onRetry={data.refresh} stale={!!data.data} /> : null}
      {data.data && !a ? (
        <Card>
          <AppText color="textMuted">This assignment isn&apos;t available.</AppText>
        </Card>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      {a ? (
        <Card>
          <View style={styles.row}>
            <AppText variant="caption" color="textSubtle" style={styles.flex}>
              {[a.due_date ? `Due ${formatDay(a.due_date)}` : 'No due date', a.max_points != null ? `out of ${Number(a.max_points)}` : null].filter(Boolean).join(' · ')}
            </AppText>
            {status ? <Pill text={status.text} tone={status.tone} /> : <Pill text="To do" tone="muted" />}
          </View>
          {brief ? <AppText>{brief}</AppText> : <AppText color="textMuted">No instructions were written for this assignment.</AppText>}
          {a.attachment_url ? (
            <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => open(a.attachment_url as string, a.attachment_name || fileName(a.attachment_url))} style={styles.fileRow}>
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {a.attachment_name || fileName(a.attachment_url)}
              </AppText>
              <AppText variant="bodyStrong" color="link">
                {busy === 'open' ? 'Opening…' : 'Open'}
              </AppText>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {a ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            YOUR WORK
          </AppText>
          <Card>
            {sub?.file_url ? (
              <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => open(sub.file_url as string, fileName(sub.file_url))} style={styles.fileRow}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {fileName(sub.file_url)}
                  </AppText>
                  {sub.submitted_at ? (
                    <AppText variant="caption" color="textSubtle">{`Handed in ${formatDay(sub.submitted_at)} · ${formatTime(sub.submitted_at)}`}</AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong" color="link">
                  {busy === 'open' ? 'Opening…' : 'Open'}
                </AppText>
              </Pressable>
            ) : (
              <AppText color="textMuted">Nothing handed in yet.</AppText>
            )}
            {grade ? <AppText variant="headline">{`Grade ${grade}`}</AppText> : null}
            {sub?.feedback ? (
              <View style={[styles.feedback, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.md }]}>
                <AppText variant="label" color="textMuted">
                  YOUR TEACHER&apos;S COMMENT
                </AppText>
                <AppText>{sub.feedback}</AppText>
              </View>
            ) : null}
            {sub?.status === 'needs_revision' ? <Notice tone="warning">Your teacher asked for a revision. Hand in a new file.</Notice> : null}
            {sub?.status === 'approved' ? <Notice tone="success">Approved by your teacher.</Notice> : null}
            {sub?.status === 'submitted' ? (
              <AppText variant="caption" color="textSubtle">
                Waiting for your teacher to review it.
              </AppText>
            ) : null}
          </Card>
        </View>
      ) : null}

      {a && canHandIn(sub) ? (
        <Card>
          {picked ? (
            <View style={styles.row}>
              <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                {picked.name}
              </AppText>
              {picked.size != null ? (
                <AppText variant="caption" color="textSubtle">{`${Math.max(1, Math.round(picked.size / 1024))} KB`}</AppText>
              ) : null}
            </View>
          ) : (
            <AppText color="textMuted">A PDF, Word or Excel file, or a photo of your work. Up to 15 MB.</AppText>
          )}
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button title="Take a photo" variant="outline" disabled={busy !== null} onPress={() => pickPhoto(true)} />
            </View>
            <View style={styles.flex}>
              <Button title="Choose a photo" variant="outline" disabled={busy !== null} onPress={() => pickPhoto(false)} />
            </View>
          </View>
          <Button title={picked ? 'Choose another file' : 'Choose a file'} variant="outline" busy={busy === 'pick'} disabled={busy !== null} onPress={pickFile} />
          {picked ? <Button title={handInLabel(sub)} busy={busy === 'send'} disabled={busy !== null} onPress={confirmSend} /> : null}
        </Card>
      ) : null}

      {sub ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            COMMENTS
          </AppText>
          <Card>
            {comments.loading && !comments.data ? <AppText color="textMuted">Loading…</AppText> : null}
            {comments.data && comments.data.comments.length === 0 ? <AppText color="textMuted">No comments yet.</AppText> : null}
            {(comments.data?.comments ?? []).map((c) => (
              <View key={c.id} style={[styles.comment, { backgroundColor: c.author_role === 'student' ? t.colors.surfaceMuted : t.colors.infoSoft, borderRadius: t.radius.md }]}>
                <AppText variant="caption" color="textSubtle">{`${commentAuthor(c)} · ${formatDay(c.created_at)} ${formatTime(c.created_at)}`}</AppText>
                <AppText>{c.body}</AppText>
              </View>
            ))}
            <TextField label="Ask a question or reply" value={reply} onChangeText={setReply} multiline />
            <Button title="Send" variant="outline" busy={busy === 'comment'} disabled={busy !== null || !reply.trim()} onPress={postComment} />
          </Card>
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
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouch },
  feedback: { padding: 12, gap: 4 },
  comment: { padding: 10, gap: 2 },
});
