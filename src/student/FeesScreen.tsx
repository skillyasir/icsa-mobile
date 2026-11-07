import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDay, kd, kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import type { Palette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { FEES_API, instalmentLine, paidShare, proofWord, type FeeEnrolment, type Proof } from './fees';

// The student's Fees (mockup 04, built 7 Nov 2026): for each enrolment the
// fee, paid and balance as the AMS computes them, the instalments, and the
// payment proofs sent — with Upload payment proof. Money is never added up
// here; a proof is a request reception confirms.

const STATE: Record<string, { bg: keyof Palette; fg: keyof Palette; mark: string }> = {
  paid: { bg: 'successSoft', fg: 'onSuccessSoft', mark: '✓' },
  partial: { bg: 'warningSoft', fg: 'onWarningSoft', mark: '◐' },
  overdue: { bg: 'dangerSoft', fg: 'onDangerSoft', mark: '!' },
  due: { bg: 'surfaceMuted', fg: 'textMuted', mark: '○' },
};
const PROOF_TONE: Record<string, keyof Palette> = { success: 'onSuccessSoft', warning: 'onWarningSoft', danger: 'onDangerSoft' };

export function FeesScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const fees = useAmsGet<{ enrollments: FeeEnrolment[] }>(FEES_API.fees.path, live);
  const proofs = useAmsGet<{ proofs: Proof[] }>(FEES_API.proofs.path, live);
  const [openedAt] = useState(() => new Date().toISOString());
  const today = kuwaitDay(openedAt) ?? '';

  if (!live) {
    return (
      <Screen title="Fees">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no fees to show.
        </Notice>
      </Screen>
    );
  }

  const list = (fees.data?.enrollments ?? []).filter((e) => e.net_amount != null || e.items.length > 0);
  const sent = proofs.data?.proofs ?? [];

  return (
    <Screen
      title="Fees"
      refreshing={fees.refreshing || proofs.refreshing}
      onRefresh={() => {
        fees.refresh();
        proofs.refresh();
      }}
    >
      {fees.loading && !fees.data ? <Loading what="Loading your fees…" /> : null}
      {fees.failure ? <LoadFailed failure={fees.failure} onRetry={fees.refresh} stale={!!fees.data} /> : null}
      {fees.data && list.length === 0 ? (
        <Card>
          <AppText color="textMuted">No fee plan on record.</AppText>
        </Card>
      ) : null}

      {list.map((e) => (
        <View key={e.id} style={{ gap: t.space.md }}>
          <Card>
            <AppText variant="caption" color="textSubtle">
              {[e.course_name, e.enrollment_no, 'KD'].filter(Boolean).join(' · ')}
            </AppText>
            <View style={styles.figures}>
              <Figure label="Course fee" value={kd(e.net_amount)} />
              <Figure label="Paid" value={kd(e.paid)} color="onSuccessSoft" />
              <Figure label="Balance" value={kd(e.balance)} color={Number(e.balance) > 0 ? 'onWarningSoft' : 'onSuccessSoft'} />
            </View>
            <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderColor: t.colors.border }]}>
              <View style={[styles.fill, { width: `${Math.round(paidShare(e) * 100)}%`, backgroundColor: t.colors.success }]} />
            </View>
          </Card>
          {e.items.length > 0 ? (
            <Card>
              {e.items.map((it, i) => {
                const l = instalmentLine(it, today, formatDay, kuwaitDay, kd);
                const s = STATE[l.state];
                return (
                  <View key={it.id} style={[styles.inst, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                    <View style={[styles.mark, { backgroundColor: t.colors[s.bg] }]}>
                      <AppText variant="bodyStrong" color={s.fg}>
                        {s.mark}
                      </AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{`Instalment ${it.installment_no}`}</AppText>
                      <AppText variant="caption" color={l.state === 'overdue' ? 'onDangerSoft' : 'textSubtle'}>
                        {l.text}
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong">{kd(it.scheduled_amount)}</AppText>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </View>
      ))}

      {fees.data ? (
        <View style={[styles.cta, { backgroundColor: t.colors.hero, borderRadius: t.radius.xl, padding: t.space.lg, gap: t.space.md }]}>
          <AppText variant="title" color="onHero">
            Paid by bank transfer or KNET?
          </AppText>
          <AppText color="onHeroMuted">Send a photo or screenshot of the payment. Reception confirms it.</AppText>
          <Button title="Upload payment proof" variant="outline" onPress={() => router.push('/student/fees/proof')} />
        </View>
      ) : null}

      {proofs.failure ? <LoadFailed failure={proofs.failure} onRetry={proofs.refresh} stale={!!proofs.data} /> : null}
      {sent.length > 0 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            PROOFS YOU SENT
          </AppText>
          <Card>
            {sent.slice(0, 10).map((p, i) => {
              const w = proofWord(p);
              return (
                <View key={p.id} style={[i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
                  <AppText variant="bodyStrong">{`${kd(p.amount)} KD · sent ${formatDay(p.submitted_at)}`}</AppText>
                  <AppText variant="caption" color={PROOF_TONE[w.tone]}>
                    {[w.text, p.course_name, p.status === 'rejected' ? p.review_note : null].filter(Boolean).join(' · ')}
                  </AppText>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function Figure({ label, value, color = 'text' }: { label: string; value: string; color?: keyof Palette }) {
  return (
    <View style={styles.flex}>
      <AppText variant="caption" color="textSubtle">
        {label}
      </AppText>
      <AppText variant="title" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  figures: { flexDirection: 'row', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  fill: { height: '100%' },
  inst: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cta: {},
});
