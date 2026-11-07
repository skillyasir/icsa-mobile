import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { failureOfAnswer, MESSAGES } from '@/api/session';
import { formatDay, kd, kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { AMS_API_URL } from '@/config';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  FEES_API,
  PROOF_FIELDS,
  PROOF_MAX_BYTES,
  PROOF_QUALITY,
  PROOF_SECOND_QUALITY,
  fitWithin,
  proofFields,
  suggestedAmount,
  type FeeEnrolment,
} from './fees';

// Upload a payment proof (mockup 04's button, built 7 Nov 2026): a photo or
// screenshot, the amount, which course — sent ONCE per tap with a live
// connection (no retry: a proof is a request reception confirms, and a second
// copy would be a second request). The photo is shrunk as the website does,
// to the AMS's 500 KB.

const UPLOAD_TIMEOUT_MS = 60_000;

type Photo = { uri: string; width: number; height: number };

async function shrink(p: Photo): Promise<string | { error: string }> {
  const size = fitWithin(p.width, p.height);
  for (const q of [PROOF_QUALITY, PROOF_SECOND_QUALITY]) {
    const ctx = ImageManipulator.manipulate(p.uri);
    if (size.width !== p.width || size.height !== p.height) ctx.resize(size);
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: q, format: SaveFormat.JPEG });
    if (new File(out.uri).size <= PROOF_MAX_BYTES) return out.uri;
  }
  return { error: 'This photo is too large to send even after shrinking. Try a screenshot instead.' };
}

export function ProofScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const { user } = useSession();
  const fees = useAmsGet<{ enrollments: FeeEnrolment[] }>(FEES_API.fees.path, !user?.preview);
  const list = (fees.data?.enrollments ?? []).filter((e) => Number(e.balance) > 0);
  const [chosen, setChosen] = useState<string | null>(null);
  const enrolment = list.find((e) => e.id === chosen) ?? (list.length === 1 ? list[0] : null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'pick' | 'send' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openedAt] = useState(() => new Date().toISOString());
  const today = kuwaitDay(openedAt) ?? '';
  const amountText = amount ?? suggestedAmount(enrolment);

  const pick = async (camera: boolean) => {
    setMessage(null);
    setBusy('pick');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setMessage('The camera is off for ICSA. Allow it in Settings, or choose a photo instead.');
          return;
        }
      }
      const r = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      setPhoto({ uri: a.uri, width: a.width, height: a.height });
    } catch (err) {
      console.warn('[proof] picking failed:', err instanceof Error ? err.message : String(err));
      setMessage('The photo could not be opened. Try another one.');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setMessage(null);
    const f = proofFields({ amount: amountText, enrollmentId: enrolment?.id ?? null, paidDate: today, note, hasPhoto: !!photo });
    if (!f.ok) return setMessage(f.message);
    if (list.length > 1 && !enrolment) return setMessage('Choose which course this payment is for.');
    if (!photo) return;
    setBusy('send');
    try {
      const small = await shrink(photo);
      if (typeof small !== 'string') return setMessage(small.error);
      const tok = await ams.token();
      if (!tok.ok) return setMessage(tok.failure.message);
      const form = new FormData();
      // React Native's FormData takes a file as { uri, name, type }.
      form.append(PROOF_FIELDS.file, { uri: small, name: 'payment-proof.jpg', type: 'image/jpeg' } as unknown as Blob);
      for (const [k, v] of Object.entries(f.fields)) form.append(k, v);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(AMS_API_URL + FEES_API.submit.path, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tok.value}`, Accept: 'application/json' },
          body: form,
          signal: ac.signal,
        });
      } catch {
        return setMessage(MESSAGES.offline);
      } finally {
        clearTimeout(timer);
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) return setMessage(failureOfAnswer(res.status, json).message);
      router.back();
    } finally {
      setBusy(null);
    }
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/fees'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Fees
      </AppText>
    </Pressable>
  );

  return (
    <Screen title="Payment proof" top={back}>
      {fees.loading && !fees.data ? <Loading what="Loading your fees…" /> : null}
      {fees.failure && !fees.data ? <LoadFailed failure={fees.failure} onRetry={fees.refresh} /> : null}
      {message ? <Notice tone="danger">{message}</Notice> : null}

      <Card>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={[styles.photo, { borderRadius: t.radius.md }]} resizeMode="contain" accessibilityLabel="The payment proof you chose" />
        ) : (
          <AppText color="textMuted">A photo or screenshot of the payment: the KNET receipt, or the bank transfer.</AppText>
        )}
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Take a photo" variant="outline" busy={busy === 'pick'} disabled={busy !== null} onPress={() => pick(true)} />
          </View>
          <View style={styles.flex}>
            <Button title={photo ? 'Choose another' : 'Choose a photo'} variant="outline" disabled={busy !== null} onPress={() => pick(false)} />
          </View>
        </View>
      </Card>

      {list.length > 1 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            WHICH COURSE
          </AppText>
          {list.map((e) => {
            const on = enrolment?.id === e.id;
            return (
              <Pressable
                key={e.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setChosen(e.id);
                  setAmount(null);
                }}
                style={[styles.choice, { borderColor: on ? t.colors.primary : t.colors.border, backgroundColor: t.colors.surface, borderRadius: t.radius.lg }]}
              >
                <AppText variant="bodyStrong">{e.course_name ?? 'Course'}</AppText>
                <AppText variant="caption" color="textSubtle">{`Balance ${kd(e.balance)} KD`}</AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <TextField label="Amount paid (KD)" value={amountText} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="90.000" />
      <TextField label="Note for reception (optional)" value={note} onChangeText={setNote} placeholder="KNET reference, bank name…" />
      <AppText variant="caption" color="textSubtle">{`Paid on ${formatDay(today)}. Reception checks the proof and records the payment.`}</AppText>

      <Button title="Send to reception" busy={busy === 'send'} disabled={busy !== null || !fees.data} onPress={send} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  photo: { width: '100%', height: 260 },
  row: { flexDirection: 'row', gap: 10 },
  choice: { borderWidth: 1.5, padding: 14, gap: 2 },
});
