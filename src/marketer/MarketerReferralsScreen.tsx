import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { AMS_API_URL } from '@/config';
import { houseDay } from '@/reception/money';
import { Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import { MORE_API, daysLeftInMonth, kdShort, pdfBody, pdfName, targetOf, thisMonth, type Referral, type RewardsMine, type TargetAnswer } from './more';

// Marketer › Referrals (bunch 2 board 3, approved 14 Nov 2026): this month's
// target as an enrolment count (no KD — Yasir, 14 Nov 2026), her coupons and
// payout balance (her own money), and her referrals this month in the
// website's order and numbering (lib/referrals.js, vendored) — with no fee,
// paid or balance: the AMS does not send a marketer a student's money.

const DAY = (v: string) => houseDay(v.slice(0, 10));

export function MarketerReferralsScreen() {
  const t = useAppTheme();
  const { user } = useSession();
  const live = !user?.preview;
  const target = useAmsGet<TargetAnswer>(MORE_API.target.path, live);
  const mine = useAmsGet<RewardsMine>(MORE_API.rewardsMine.path, live);
  const refs = useAmsGet<{ referrals: Referral[] }>(MORE_API.referrals.path, live);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = kuwaitDay(new Date()) ?? '';
  const month = thisMonth(refs.data?.referrals, today);
  const goal = targetOf(target.data);
  const monthName = houseDay(today).split(' ')[1] ?? '';

  // The website's own PDF (POST /referrals/pdf, rendered as her), shared from the phone.
  const pdf = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const tok = await ams.token();
      if (!tok.ok) return setMessage(tok.failure.message);
      const res = await fetch(AMS_API_URL + MORE_API.referralsPdf.path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok.value}`, 'Content-Type': 'application/json', Accept: 'application/pdf' },
        body: JSON.stringify(pdfBody(month.from, month.to)),
      });
      if (!res.ok) {
        let why = 'The PDF could not be made. Try once more.';
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) why = j.error;
        } catch {
          // not JSON: keep the plain words
        }
        return setMessage(why);
      }
      const file = new File(Paths.cache, pdfName(month.from, month.to, DAY));
      if (file.exists) file.delete();
      file.write(new Uint8Array(await res.arrayBuffer()));
      if (!(await Sharing.isAvailableAsync())) return setMessage('This phone has no app to share the PDF with.');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'My referrals' });
    } catch (err) {
      console.warn('[referrals] the PDF failed:', err instanceof Error ? err.message : String(err));
      setMessage('The PDF could not be made. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const rows = showAll ? month.rows : month.rows.slice(0, 5);

  return (
    <Screen title="Referrals" refreshing={refs.refreshing} onRefresh={live ? refs.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          <View style={[styles.hero, { backgroundColor: t.colors.hero, borderRadius: t.radius.lg, gap: t.space.sm }]}>
            <AppText variant="label" color="onHeroMuted">{`${monthName.toUpperCase()} TARGET`}</AppText>
            {target.loading && !target.data ? <AppText color="onHeroMuted">Loading…</AppText> : null}
            {target.failure && !target.data ? <AppText color="onHeroMuted">{target.failure.message}</AppText> : null}
            {target.data && !goal ? <AppText color="onHero">No target is set for you this month.</AppText> : null}
            {goal ? (
              <>
                <AppText variant="title" color="onHero">{`${goal.done} of ${goal.of} enrolments`}</AppText>
                <View style={[styles.track, { borderRadius: t.radius.pill }]}>
                  <View style={[styles.fill, { width: `${Math.min(100, Math.round((goal.done / goal.of) * 100))}%`, backgroundColor: t.colors.attention, borderRadius: t.radius.pill }]} />
                </View>
                <AppText variant="caption" color="onHeroMuted">{`${Math.max(0, goal.of - goal.done)} to go · ${daysLeftInMonth(today)} days left`}</AppText>
              </>
            ) : null}
          </View>

          <Card>
            <Label>MY COUPONS</Label>
            {mine.failure && !mine.data ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} /> : null}
            {mine.data ? (
              <>
                <AppText variant="bodyStrong">{`${mine.data.stats.issued_all} given · ${mine.data.stats.used_month} used this month`}</AppText>
                <AppText color="textSubtle">{`Payout balance ${kdShort(mine.data.wallet.balance)}`}</AppText>
              </>
            ) : null}
          </Card>

          <View style={styles.between}>
            <Label>{`MY REFERRALS · ${monthName.toUpperCase()} · ${month.rows.length}`}</Label>
            <Button title={busy ? 'Making…' : 'PDF'} variant="outline" block={false} busy={busy} disabled={busy || month.rows.length === 0} onPress={pdf} />
          </View>
          {message ? <Notice tone="danger">{message}</Notice> : null}
          {refs.loading && !refs.data ? <Loading what="Loading your referrals…" /> : null}
          {refs.failure ? <LoadFailed failure={refs.failure} onRetry={refs.refresh} stale={!!refs.data} /> : null}
          {refs.data && month.rows.length === 0 ? (
            <Card>
              <AppText color="textMuted">No referrals this month yet.</AppText>
            </Card>
          ) : null}
          {rows.map((r, i) => (
            <Card key={r.id}>
              <View style={styles.between}>
                <AppText variant="bodyStrong" style={styles.grow}>{`${i + 1}. ${r.student_name ?? 'Student'}`}</AppText>
                {r.student_status ? (
                  <AppText variant="caption" color="textSubtle">
                    {r.student_status}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="caption" color="textMuted">
                {[
                  r.course_name,
                  r.enrollment_no,
                  r.attended != null ? `${Number(r.attended)} class${Number(r.attended) === 1 ? '' : 'es'}` : null,
                  r.last_attended ? `last ${DAY(r.last_attended)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </Card>
          ))}
          {month.rows.length > 5 ? <Button title={showAll ? 'Show fewer' : `All ${month.rows.length} referrals`} variant="outline" onPress={() => setShowAll(!showAll)} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 16 },
  track: { height: 10, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
});
