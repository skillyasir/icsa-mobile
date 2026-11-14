import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { houseDay } from '@/reception/money';
import { DASHBOARD_TODAY, kdAmount, todayFigures, type ApprovalsSummary, type Dashboard } from '@/reception/rules';
import { Chips, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  APPROVALS_API,
  CERTIFICATES_PENDING,
  CERT_TYPE_WORD,
  DISCOUNTS_PENDING,
  REFUNDS_PENDING,
  alreadyDecided,
  declineBody,
  filterChips,
  notYetWords,
  readyToIssue,
  type CertificateRequest,
  type Discount,
  type Filter,
  type Kind,
  type Refund,
} from './approvals';

// Manager › Approvals (mockup 15, approved 3 Nov 2026; built 14 Nov 2026):
// today's figures, then every request waiting for a manager — refunds,
// discounts, certificates — each with Approve and Decline, and the payment
// proofs reception also works. The AMS decides every one of them.

type Outcome = { tone: 'success' | 'warning' | 'danger'; text: string };

// One plain pathFor per endpoint, so today.check §1b reads every call site.
const DECIDE: Record<Kind, { yes: (id: string) => string; no: (id: string) => string }> = {
  refund: { yes: (id) => pathFor(APPROVALS_API.approveRefund.path, { id }), no: (id) => pathFor(APPROVALS_API.rejectRefund.path, { id }) },
  discount: { yes: (id) => pathFor(APPROVALS_API.approveDiscount.path, { id }), no: (id) => pathFor(APPROVALS_API.rejectDiscount.path, { id }) },
  certificate: { yes: (id) => pathFor(APPROVALS_API.approveCertificate.path, { id }), no: (id) => pathFor(APPROVALS_API.declineCertificate.path, { id }) },
};
const DAY = (v: string) => houseDay(kuwaitDay(v));

export function ApprovalsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const dash = useAmsGet<Dashboard>(DASHBOARD_TODAY, live);
  const summary = useAmsGet<ApprovalsSummary>(APPROVALS_API.summary.path, live);
  const refunds = useAmsGet<{ refunds: Refund[] }>(REFUNDS_PENDING, live);
  const discounts = useAmsGet<{ requests: Discount[] }>(DISCOUNTS_PENDING, live);
  const certs = useAmsGet<CertificateRequest[]>(CERTIFICATES_PENDING, live);
  const [filter, setFilter] = useState<Filter>('all');
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const R = refunds.data?.refunds ?? [];
  const D = discounts.data?.requests ?? [];
  const C = certs.data ?? [];
  const show = (k: Kind) => filter === 'all' || filter === k;
  const reloadAll = () => Promise.all([refunds.reload(), discounts.reload(), certs.reload(), summary.reload()]);

  const decide = async (kind: Kind, id: string, approve: boolean, who: string) => {
    setOutcome(null);
    let path: string;
    let body: Record<string, string> | undefined;
    if (approve) {
      path = DECIDE[kind].yes(id);
    } else {
      const b = declineBody(kind, reason);
      if (!b.ok) return setOutcome({ tone: 'warning', text: b.message });
      body = b.body;
      path = DECIDE[kind].no(id);
    }
    setBusy(`${kind}-${id}`);
    try {
      const r = await ams.request('POST', path, body);
      if (r.ok || alreadyDecided(kind, r.failure.message)) {
        setOutcome({ tone: 'success', text: `${approve ? (kind === 'certificate' ? 'Issued' : 'Approved') : 'Declined'} — ${who}.` });
        setDeclining(null);
        setReason('');
      } else setOutcome({ tone: 'danger', text: r.failure.message });
      await reloadAll();
    } finally {
      setBusy(null);
    }
  };

  const confirm = (kind: Kind, id: string, title: string, detail: string, who: string) =>
    Alert.alert(title, detail, [
      { text: 'Not yet', style: 'cancel' },
      { text: kind === 'certificate' ? 'Issue' : 'Approve', onPress: () => decide(kind, id, true, who) },
    ]);

  const declineBox = (kind: Kind, id: string, who: string) =>
    declining === `${kind}-${id}` ? (
      <View style={{ gap: t.space.sm }}>
        <TextField label="Why it is declined" value={reason} onChangeText={setReason} placeholder="The reason is kept with the request" />
        <Button title="Decline" variant="danger" busy={busy === `${kind}-${id}`} disabled={busy !== null} onPress={() => decide(kind, id, false, who)} />
        <Button title="Cancel" variant="outline" disabled={busy !== null} onPress={() => setDeclining(null)} />
      </View>
    ) : null;

  const buttons = (kind: Kind, id: string, onApprove: () => void, approveTitle = 'Approve') =>
    declining === `${kind}-${id}` ? null : (
      <View style={[styles.row, { gap: t.space.sm }]}>
        <View style={styles.grow}>
          <Button title="Decline" variant="outline" disabled={busy !== null} onPress={() => { setReason(''); setDeclining(`${kind}-${id}`); }} />
        </View>
        <View style={styles.grow}>
          <Button title={approveTitle} variant="success" busy={busy === `${kind}-${id}`} disabled={busy !== null} onPress={onApprove} />
        </View>
      </View>
    );

  const loading = (refunds.loading && !refunds.data) || (discounts.loading && !discounts.data) || (certs.loading && !certs.data);
  const empty = !loading && R.length + D.length + C.length === 0;

  return (
    <Screen title="Approvals" eyebrow="All branches" refreshing={refunds.refreshing} onRefresh={live ? () => void reloadAll() : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          {dash.data ? (
            <View style={[styles.row, { gap: t.space.sm }]}>
              {todayFigures(dash.data).map((f) => (
                <View key={f.label} style={[styles.figure, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
                  <AppText variant="caption" color="textSubtle">{f.label}</AppText>
                  <AppText variant="headline">{f.value}</AppText>
                  <AppText variant="caption" color="textSubtle">{f.sub}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          {dash.failure && !dash.data ? <LoadFailed failure={dash.failure} onRetry={dash.refresh} /> : null}

          {summary.data && summary.data.payment_proofs > 0 ? (
            <Button title={`Payment proofs from students · ${summary.data.payment_proofs}`} variant="outline" onPress={() => router.push('/payment-proofs')} />
          ) : null}

          <Chips options={filterChips({ refund: R.length, discount: D.length, certificate: C.length })} value={filter} onChange={setFilter} />
          {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}
          {loading ? <Loading what="Loading what is waiting…" /> : null}
          {[refunds.failure, discounts.failure, certs.failure].map((f, i) => (f ? <LoadFailed key={i} failure={f} onRetry={() => void reloadAll()} stale /> : null))}
          {empty ? (
            <Card>
              <AppText color="textMuted">Nothing is waiting for you.</AppText>
            </Card>
          ) : null}

          {show('refund')
            ? R.map((r) => {
                const who = r.student_name ?? 'the student';
                return (
                  <Card key={`r-${r.id}`}>
                    <Label>{`REFUND · ${DAY(r.initiated_at).toUpperCase()}`}</Label>
                    <View style={styles.between}>
                      <AppText variant="headline" style={styles.grow}>{who}</AppText>
                      <AppText variant="headline">{`KD ${kdAmount(r.amount)}`}</AppText>
                    </View>
                    <AppText color="textMuted">
                      {[r.course_name ?? r.charge_description ?? r.sale_item_name, r.reason ? `“${r.reason}”` : null, r.initiated_by_name ? `requested by ${r.initiated_by_name}` : null].filter(Boolean).join(' · ')}
                    </AppText>
                    {buttons('refund', r.id, () => confirm('refund', r.id, 'Approve this refund?', `${who} · KD ${kdAmount(r.amount)}. The money is paid out when it is completed, with the proof.`, who))}
                    {declineBox('refund', r.id, who)}
                  </Card>
                );
              })
            : null}

          {show('discount')
            ? D.map((d) => {
                const who = d.student_name ?? 'the student';
                return (
                  <Card key={`d-${d.id}`}>
                    <Label>{`DISCOUNT · ${DAY(d.created_at).toUpperCase()}`}</Label>
                    <View style={styles.between}>
                      <AppText variant="headline" style={styles.grow}>{who}</AppText>
                      <AppText variant="headline">{`KD ${kdAmount(d.new_discount)}`}</AppText>
                    </View>
                    <AppText color="textMuted">
                      {[d.course_name, `fee KD ${kdAmount(d.gross_amount)}`, `discount now KD ${kdAmount(d.old_discount)}`].filter(Boolean).join(' · ')}
                    </AppText>
                    {d.reason || d.requested_by_name ? <AppText>{[d.reason ? `“${d.reason}”` : null, d.requested_by_name ? `requested by ${d.requested_by_name}` : null].filter(Boolean).join(' · ')}</AppText> : null}
                    {buttons('discount', d.id, () => confirm('discount', d.id, 'Approve this discount?', `${who} · discount KD ${kdAmount(d.new_discount)} (now KD ${kdAmount(d.old_discount)}). The AMS applies it to the fee plan.`, who))}
                    {declineBox('discount', d.id, who)}
                  </Card>
                );
              })
            : null}

          {show('certificate')
            ? C.map((c) => {
                const who = c.student_name ?? 'the student';
                return (
                  <Card key={`c-${c.id}`}>
                    <Label>{`${(CERT_TYPE_WORD[c.type] ?? 'Certificate').toUpperCase()} · ${DAY(c.requested_at).toUpperCase()}`}</Label>
                    <AppText variant="headline">{who}</AppText>
                    <AppText color="textMuted">
                      {[c.course_name ?? c.subject_name, c.requested_by_name ? `requested by ${c.requested_by_name}` : null].filter(Boolean).join(' · ')}
                    </AppText>
                    {readyToIssue(c) ? (
                      <>
                        <AppText variant="bodyStrong" color="success">Ready to issue</AppText>
                        {buttons('certificate', c.id, () => confirm('certificate', c.id, 'Issue this certificate?', `${who}. It is issued as the request stands — check the title, printed line and photo on the website first if anything should change.`, who), 'Issue')}
                        {declineBox('certificate', c.id, who)}
                      </>
                    ) : (
                      <AppText color="textSubtle">{notYetWords(c)}</AppText>
                    )}
                  </Card>
                );
              })
            : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  figure: { flex: 1, borderWidth: 1, padding: 10, gap: 2 },
});
