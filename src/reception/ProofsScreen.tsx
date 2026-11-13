import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { formatDay, formatTime, kd } from '@/attendance/rules';
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

import { ALREADY_REVIEWED, RECEPTION_API, type ProofMethod, type ProofRow } from './rules';

// Payment proofs from students (Needs you › Payment proofs; 13 Nov 2026). A
// proof is a student's REQUEST: approving it records the payment (the AMS's
// approveProof, with the method the desk picks); rejecting tells the student
// why. The AMS lists the branch's pending proofs and locks each one, so two
// people approving at once record ONE payment — the second is told it was
// already reviewed.

type Outcome = { tone: 'success' | 'warning' | 'danger'; text: string };

export function ProofsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const list = useAmsGet<{ count: number; proofs: ProofRow[] }>(RECEPTION_API.proofs.path, live);
  const methods = useAmsGet<{ methods: ProofMethod[] }>(RECEPTION_API.proofMethods.path, live);
  const [method, setMethod] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const proofs = list.data?.proofs ?? [];
  const all = methods.data?.methods ?? [];

  const approve = (p: ProofRow) => {
    const m = all.find((x) => x.id === method[p.id]);
    if (!m) {
      setOutcome({ tone: 'warning', text: 'Pick how the student paid, then approve.' });
      return;
    }
    Alert.alert('Approve and record this payment?', `${p.student_name ?? 'The student'} · KD ${kd(p.amount)} · ${m.name}. This records the payment.`, [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setOutcome(null);
          setBusy(`approve-${p.id}`);
          const r = await ams.request('POST', pathFor(RECEPTION_API.approveProof.path, { id: p.id }), { payment_method_id: m.id });
          // A retried approve that finds the proof already reviewed has done its work (AMS S5 note).
          if (r.ok || r.failure.message === ALREADY_REVIEWED) setOutcome({ tone: 'success', text: `Approved — KD ${kd(p.amount)} recorded for ${p.student_name ?? 'the student'}.` });
          else setOutcome({ tone: 'danger', text: r.failure.message });
          await list.reload();
          setBusy(null);
        },
      },
    ]);
  };

  const reject = async (p: ProofRow) => {
    setOutcome(null);
    setBusy(`reject-${p.id}`);
    const r = await ams.request('POST', pathFor(RECEPTION_API.rejectProof.path, { id: p.id }), { reason: reason.trim() || null });
    if (r.ok || r.failure.message === ALREADY_REVIEWED) {
      setOutcome({ tone: 'success', text: `Rejected — ${p.student_name ?? 'the student'} is told why.` });
      setRejecting(null);
      setReason('');
    } else setOutcome({ tone: 'danger', text: r.failure.message });
    await list.reload();
    setBusy(null);
  };

  const view = async (p: ProofRow) => {
    if (!p.proof_url) return;
    const err = await openAmsFile(p.proof_url, `proof-${p.student_code ?? p.id}${p.proof_url.match(/\.[a-z0-9]+$/i)?.[0] ?? ''}`);
    if (err) setOutcome({ tone: 'danger', text: err });
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Back
      </AppText>
    </Pressable>
  );

  return (
    <Screen title="Payment proofs" top={back} refreshing={list.refreshing} onRefresh={live ? list.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : list.loading && !list.data ? (
        <Loading what="Loading the proofs…" />
      ) : list.failure && !list.data ? (
        <LoadFailed failure={list.failure} onRetry={list.refresh} />
      ) : (
        <>
          {list.failure ? <LoadFailed failure={list.failure} onRetry={list.refresh} stale /> : null}
          {methods.failure ? <LoadFailed failure={methods.failure} onRetry={methods.refresh} stale={!!methods.data} /> : null}
          {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}
          {proofs.length === 0 ? (
            <Card>
              <AppText color="textMuted">No payment proofs are waiting.</AppText>
            </Card>
          ) : null}
          {proofs.map((p) => (
            <Card key={p.id}>
              <AppText variant="headline">{p.student_name ?? 'Student'}</AppText>
              <AppText variant="caption" color="textSubtle">
                {[p.student_code, p.course_name].filter(Boolean).join(' · ')}
              </AppText>
              <AppText variant="title">KD {kd(p.amount)}</AppText>
              <AppText color="textMuted">
                {[p.paid_date ? `Paid ${formatDay(p.paid_date)}` : null, `sent ${formatDay(p.submitted_at)} ${formatTime(p.submitted_at)}`].filter(Boolean).join(' · ')}
              </AppText>
              {p.note ? <AppText>“{p.note}”</AppText> : null}
              {p.proof_url ? <Button title="View the proof" variant="outline" onPress={() => view(p)} /> : null}

              <AppText variant="label" color="textMuted">
                HOW THEY PAID
              </AppText>
              <View style={[styles.chips, { gap: t.space.sm }]}>
                {all.map((m) => {
                  const on = method[p.id] === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      onPress={() => setMethod((x) => ({ ...x, [p.id]: m.id }))}
                      style={[
                        styles.chip,
                        { borderRadius: t.radius.pill, borderColor: on ? t.colors.primary : t.colors.borderStrong, backgroundColor: on ? t.colors.primary : t.colors.surface },
                      ]}
                    >
                      <AppText variant="bodyStrong" style={{ color: on ? t.colors.onPrimary : t.colors.text }}>
                        {m.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <Button title="Approve and record" variant="success" busy={busy === `approve-${p.id}`} disabled={busy !== null} onPress={() => approve(p)} />
              {rejecting === p.id ? (
                <View style={{ gap: t.space.sm }}>
                  <TextField label="Why it is rejected (the student sees this)" value={reason} onChangeText={setReason} placeholder="The amount does not match the receipt" />
                  <Button title="Reject" variant="danger" busy={busy === `reject-${p.id}`} disabled={busy !== null} onPress={() => reject(p)} />
                  <Button title="Cancel" variant="outline" disabled={busy !== null} onPress={() => setRejecting(null)} />
                </View>
              ) : (
                <Button title="Reject…" variant="outline" disabled={busy !== null} onPress={() => setRejecting(p.id)} />
              )}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, paddingHorizontal: 14, minHeight: minTouch - 4, justifyContent: 'center' },
});
