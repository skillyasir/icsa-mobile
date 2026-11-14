import { File, UploadType } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { failureOfAnswer, MESSAGES } from '@/api/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { AMS_API_URL } from '@/config';
import { shrinkPhoto } from '@/files/shrinkPhoto';
import { useAppTheme } from '@/theme/useAppTheme';

import { MONEY_API, PROOF_UPLOAD_FIELD } from './money';
import { Label } from './ui';

// The proof of payment a method requires (KNET, transfer…): a photo, shrunk to
// the AMS's 500 KB and sent at once to POST /uploads/payment-proof (field
// `proof`) by expo-file-system's multipart upload — never FormData + fetch
// (HANDOVER, 8 Nov 2026). It is sent when picked, so the money press that
// follows carries a FIXED proof_url: a retry of that press must send the same
// body (AMS S5 compares it). The upload itself writes no money.

const UPLOAD_TIMEOUT_MS = 60_000;

export function ProofField({ url, onChange, required }: { url: string | null; onChange: (url: string | null) => void; required: boolean }) {
  const t = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    setMessage(null);
    setBusy(true);
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setMessage('The camera is off for ICSA. Allow it in Settings, or choose a photo instead.');
      }
      const r = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      const small = await shrinkPhoto({ uri: a.uri, width: a.width, height: a.height });
      if (typeof small !== 'string') return setMessage(small.error);
      const tok = await ams.token();
      if (!tok.ok) return setMessage(tok.failure.message);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), UPLOAD_TIMEOUT_MS);
      let res: { status: number; body: string };
      try {
        res = await new File(small).upload(AMS_API_URL + MONEY_API.proofUpload.path, {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: PROOF_UPLOAD_FIELD,
          mimeType: 'image/jpeg',
          headers: { Authorization: `Bearer ${tok.value}`, Accept: 'application/json' },
          sessionType: 'foreground',
          signal: ac.signal,
        });
      } catch (err) {
        console.warn('[proof] the upload failed:', err instanceof Error ? err.message : String(err));
        return setMessage(MESSAGES.offline);
      } finally {
        clearTimeout(timer);
      }
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(res.body) as Record<string, unknown>;
      } catch {
        // not JSON: the status decides
      }
      if (res.status < 200 || res.status >= 300 || typeof json.url !== 'string') {
        return setMessage(failureOfAnswer(res.status, json).message);
      }
      setPreview(small);
      onChange(json.url);
    } catch (err) {
      console.warn('[proof] picking failed:', err instanceof Error ? err.message : String(err));
      setMessage('The photo could not be opened. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <Label>{required ? 'PROOF PHOTO — REQUIRED FOR THIS METHOD' : 'PROOF PHOTO'}</Label>
      {url ? (
        <View style={[styles.row, { gap: t.space.md }]}>
          {preview ? <Image source={{ uri: preview }} style={[styles.thumb, { borderRadius: t.radius.sm }]} accessibilityIgnoresInvertColors /> : null}
          <AppText variant="bodyStrong" color="success">
            ✓ Proof photo added
          </AppText>
        </View>
      ) : null}
      {message ? <AppText color="onDangerSoft">{message}</AppText> : null}
      <View style={[styles.row, { gap: t.space.sm }]}>
        <View style={styles.half}>
          <Button title={url ? 'Retake' : 'Take photo'} variant="outline" busy={busy} disabled={busy} onPress={() => pick(true)} />
        </View>
        <View style={styles.half}>
          <Button title="Choose photo" variant="outline" disabled={busy} onPress={() => pick(false)} />
        </View>
      </View>
      {url ? <Button title="Remove the proof" variant="outline" disabled={busy} onPress={() => { setPreview(null); onChange(null); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  half: { flex: 1 },
  thumb: { width: 56, height: 56 },
});
