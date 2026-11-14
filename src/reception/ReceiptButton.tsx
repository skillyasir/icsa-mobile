import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { kuwaitDay } from '@/attendance/rules';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { AMS_API_URL } from '@/config';
import { useAppTheme } from '@/theme/useAppTheme';

import { MONEY_API, receiptFileName } from './money';

// The receipt as a PDF for the share sheet (AMS S10, docs/07): the website's own
// receipt, rendered by the AMS (a headless browser — usually a few seconds, up to
// ~45 s), downloaded with the sign-in and handed to WhatsApp, email or Files.
// Nothing is kept on the server; the phone's copy lives in its cache.

export function ReceiptButton({ enrollmentId, enrollmentNo }: { enrollmentId: string; enrollmentNo: string | null }) {
  const t = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const share = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const tok = await ams.token();
      if (!tok.ok) return setMessage(tok.failure.message);
      const dest = new File(Paths.cache, receiptFileName(enrollmentNo, kuwaitDay(new Date()) ?? ''));
      try {
        if (dest.exists) dest.delete();
      } catch {
        // an old copy that will not go is overwritten below or refused there
      }
      let file: File;
      try {
        file = await File.downloadFileAsync(AMS_API_URL + pathFor(MONEY_API.receiptPdf.path, { id: enrollmentId }), dest, {
          headers: { Authorization: `Bearer ${tok.value}`, Accept: 'application/pdf' },
          idempotent: true,
        });
      } catch (err) {
        const why = err instanceof Error ? err.message : String(err);
        console.warn('[receipt] the PDF did not come:', why);
        // The AMS: 403 not yours to see, 404 no such enrolment, 5xx the render failed (try once more).
        if (/\b403\b/.test(why)) return setMessage('This receipt is not in your branch.');
        if (/\b404\b/.test(why)) return setMessage('The enrolment was not found.');
        return setMessage('The receipt could not be made. Try once more; if it fails again, tell the manager.');
      }
      if (!(await Sharing.isAvailableAsync())) return setMessage('This phone has no app to share the receipt with.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Send the receipt' });
    } catch (err) {
      console.warn('[receipt] sharing failed:', err instanceof Error ? err.message : String(err));
      setMessage('The receipt could not be shared.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: t.space.sm }}>
      <Button title={busy ? 'Making the receipt…' : 'Send the receipt (PDF)'} variant="primary" busy={busy} disabled={busy} onPress={share} />
      {busy ? <AppText variant="caption" color="textSubtle">The AMS draws the receipt — this can take up to a minute.</AppText> : null}
      {message ? <AppText color="onDangerSoft">{message}</AppText> : null}
    </View>
  );
}
