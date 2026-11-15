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
  BOOKS_PENDING,
  CERTIFICATES_PENDING,
  CERT_TYPE_WORD,
  CHECKINS_PENDING,
  DISCOUNTS_PENDING,
  OUT_OF_STOCK_WORDS,
  OWN_CHECKIN_WORDS,
  REFUNDS_PENDING,
  TRANSFERS_PENDING,
  alreadyDecided,
  approveBody,
  bookDoneWords,
  bookFeeLine,
  bookInStock,
  bookRuleLine,
  checkinDay,
  checkinDoneWords,
  checkinLine,
  checkinPills,
  checkinTime,
  declineBody,
  filterChips,
  notYetWords,
  ownCheckin,
  readyToIssue,
  rejectWarning,
  settledWords,
  shownFilter,
  stockPill,
  transferDoneWords,
  transferEnd,
  transferWarning,
  type BookRequest,
  type CertificateRequest,
  type Checkin,
  type Discount,
  type Filter,
  type Kind,
  type Pill,
  type Refund,
  type Transfer,
} from './approvals';

// Manager › Approvals (mockup 15, approved 3 Nov 2026; built 14 Nov 2026):
// today's figures, then every request waiting for a manager — refunds,
// discounts, certificates, and (Managers bunch 2, mockups approved 15 Nov
// 2026) staff check-ins kept for review, payment transfers and free books —
// each with its Approve and Decline, and the payment proofs reception also
// works. The AMS decides every one of them.

type Outcome = { tone: 'success' | 'warning' | 'danger' | 'info'; text: string };
type Done = (answer: Record<string, unknown>) => string;

// One plain pathFor per endpoint, so today.check §1b reads every call site.
const DECIDE: Record<Kind, { yes: (id: string, enr: string) => string; no: (id: string, enr: string) => string }> = {
  refund: { yes: (id) => pathFor(APPROVALS_API.approveRefund.path, { id }), no: (id) => pathFor(APPROVALS_API.rejectRefund.path, { id }) },
  discount: { yes: (id) => pathFor(APPROVALS_API.approveDiscount.path, { id }), no: (id) => pathFor(APPROVALS_API.rejectDiscount.path, { id }) },
  certificate: { yes: (id) => pathFor(APPROVALS_API.approveCertificate.path, { id }), no: (id) => pathFor(APPROVALS_API.declineCertificate.path, { id }) },
  checkin: { yes: (id) => pathFor(APPROVALS_API.decideCheckin.path, { id }), no: (id) => pathFor(APPROVALS_API.decideCheckin.path, { id }) },
  transfer: { yes: (id) => pathFor(APPROVALS_API.approveTransfer.path, { id }), no: (id) => pathFor(APPROVALS_API.rejectTransfer.path, { id }) },
  book: { yes: (id, enr) => pathFor(APPROVALS_API.approveBook.path, { id: enr, releaseId: id }), no: (id, enr) => pathFor(APPROVALS_API.rejectBook.path, { id: enr, releaseId: id }) },
};
const DAY = (v: string | null) => (v ? houseDay(kuwaitDay(v)) : '');

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
  const checkins = useAmsGet<{ reviews: Checkin[] }>(CHECKINS_PENDING, live);
  const transfers = useAmsGet<{ transfers: Transfer[] }>(TRANSFERS_PENDING, live);
  const books = useAmsGet<{ approvals: BookRequest[] }>(BOOKS_PENDING, live);
  const [filter, setFilter] = useState<Filter>('all');
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const R = refunds.data?.refunds ?? [];
  const D = discounts.data?.requests ?? [];
  const C = certs.data ?? [];
  const K = checkins.data?.reviews ?? [];
  const T = transfers.data?.transfers ?? [];
  const B = books.data?.approvals ?? [];
  const counts: Record<Kind, number> = { refund: R.length, discount: D.length, certificate: C.length, checkin: K.length, transfer: T.length, book: B.length };
  const showing = shownFilter(filter, counts);
  const show = (k: Kind) => showing === 'all' || showing === k;
  const lists = [refunds, discounts, certs, checkins, transfers, books];
  const reloadAll = () => Promise.all([...lists.map((l) => l.reload()), summary.reload()]);

  const decide = async (kind: Kind, id: string, approve: boolean, done: Done, enr = '') => {
    setOutcome(null);
    let path: string;
    let body: Record<string, string> | undefined;
    if (approve) {
      path = DECIDE[kind].yes(id, enr);
      body = approveBody(kind);
    } else {
      const b = declineBody(kind, reason);
      if (!b.ok) return setOutcome({ tone: 'warning', text: b.message });
      body = b.body;
      path = DECIDE[kind].no(id, enr);
    }
    setBusy(`${kind}-${id}`);
    try {
      const r = await ams.request('POST', path, body);
      if (r.ok) setOutcome({ tone: 'success', text: done(r.value) });
      // Decided already — by this press arriving twice, or another manager first: said as the AMS says it.
      else if (alreadyDecided(kind, r.failure.message)) setOutcome({ tone: 'info', text: settledWords(kind, r.failure.message) });
      else setOutcome({ tone: 'danger', text: r.failure.message });
      if (r.ok || alreadyDecided(kind, r.failure.message)) {
        setDeclining(null);
        setReason('');
      }
      await reloadAll();
    } finally {
      setBusy(null);
    }
  };

  const confirm = (kind: Kind, id: string, title: string, detail: string, yes: string, done: Done, enr = '') =>
    Alert.alert(title, detail, [
      { text: 'Not yet', style: 'cancel' },
      { text: yes, onPress: () => decide(kind, id, true, done, enr) },
    ]);

  const declineBox = (kind: Kind, id: string, word: 'Decline' | 'Reject', done: Done, enr = '') =>
    declining === `${kind}-${id}` ? (
      <View style={{ gap: t.space.sm }}>
        <TextField label={word === 'Reject' ? 'Why it is rejected' : 'Why it is declined'} value={reason} onChangeText={setReason} placeholder="The reason is kept with the request" />
        <Button title={word} variant="danger" busy={busy === `${kind}-${id}`} disabled={busy !== null} onPress={() => decide(kind, id, false, done, enr)} />
        <Button title="Cancel" variant="outline" disabled={busy !== null} onPress={() => setDeclining(null)} />
      </View>
    ) : null;

  const buttons = (kind: Kind, id: string, onApprove: () => void, approveTitle = 'Approve', word: 'Decline' | 'Reject' = 'Decline', approveOff = false) =>
    declining === `${kind}-${id}` ? null : (
      <View style={[styles.row, { gap: t.space.sm }]}>
        <View style={styles.grow}>
          <Button title={word} variant="outline" disabled={busy !== null} onPress={() => { setReason(''); setDeclining(`${kind}-${id}`); }} />
        </View>
        <View style={styles.grow}>
          <Button title={approveTitle} variant="success" busy={busy === `${kind}-${id}`} disabled={busy !== null || approveOff} onPress={onApprove} />
        </View>
      </View>
    );

  const pills = (list: Pill[]) =>
    list.length ? (
      <View style={[styles.wrap, { gap: t.space.sm }]}>
        {list.map((p) => (
          <View key={p.text} style={[styles.pill, { backgroundColor: p.tone === 'success' ? t.colors.successSoft : t.colors.dangerSoft, borderRadius: t.radius.pill }]}>
            <AppText variant="caption" color={p.tone === 'success' ? 'onSuccessSoft' : 'onDangerSoft'}>
              {p.text}
            </AppText>
          </View>
        ))}
      </View>
    ) : null;

  const band = (text: string, tone: 'warning' | 'danger') => (
    <View style={[styles.band, { backgroundColor: tone === 'warning' ? t.colors.warningSoft : t.colors.dangerSoft, borderRadius: t.radius.md }]}>
      <AppText variant="bodyStrong" color={tone === 'warning' ? 'onWarningSoft' : 'onDangerSoft'}>
        {text}
      </AppText>
    </View>
  );

  const head = (label: string, who: string, right: string) => (
    <>
      <Label>{label}</Label>
      <View style={styles.between}>
        <AppText variant="headline" style={styles.grow}>{who}</AppText>
        <AppText variant="headline">{right}</AppText>
      </View>
    </>
  );

  const loading = lists.some((l) => l.loading && !l.data);
  const empty = !loading && Object.values(counts).every((n) => n === 0);
  const said = (word: string, who: string): Done => () => `${word} — ${who}.`;

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

          <Chips options={filterChips(counts)} value={showing} onChange={setFilter} />
          {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}
          {loading ? <Loading what="Loading what is waiting…" /> : null}
          {lists.map((l, i) => (l.failure ? <LoadFailed key={i} failure={l.failure} onRetry={() => void reloadAll()} stale /> : null))}
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
                    {head(`REFUND · ${DAY(r.initiated_at).toUpperCase()}`, who, `KD ${kdAmount(r.amount)}`)}
                    <AppText color="textMuted">
                      {[r.course_name ?? r.charge_description ?? r.sale_item_name, r.reason ? `“${r.reason}”` : null, r.initiated_by_name ? `requested by ${r.initiated_by_name}` : null].filter(Boolean).join(' · ')}
                    </AppText>
                    {buttons('refund', r.id, () => confirm('refund', r.id, 'Approve this refund?', `${who} · KD ${kdAmount(r.amount)}. The money is paid out when it is completed, with the proof.`, 'Approve', said('Approved', who)))}
                    {declineBox('refund', r.id, 'Decline', said('Declined', who))}
                  </Card>
                );
              })
            : null}

          {show('discount')
            ? D.map((d) => {
                const who = d.student_name ?? 'the student';
                return (
                  <Card key={`d-${d.id}`}>
                    {head(`DISCOUNT · ${DAY(d.created_at).toUpperCase()}`, who, `KD ${kdAmount(d.new_discount)}`)}
                    <AppText color="textMuted">
                      {[d.course_name, `fee KD ${kdAmount(d.gross_amount)}`, `discount now KD ${kdAmount(d.old_discount)}`].filter(Boolean).join(' · ')}
                    </AppText>
                    {d.reason || d.requested_by_name ? <AppText>{[d.reason ? `“${d.reason}”` : null, d.requested_by_name ? `requested by ${d.requested_by_name}` : null].filter(Boolean).join(' · ')}</AppText> : null}
                    {buttons('discount', d.id, () => confirm('discount', d.id, 'Approve this discount?', `${who} · discount KD ${kdAmount(d.new_discount)} (now KD ${kdAmount(d.old_discount)}). The AMS applies it to the fee plan.`, 'Approve', said('Approved', who)))}
                    {declineBox('discount', d.id, 'Decline', said('Declined', who))}
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
                        {buttons('certificate', c.id, () => confirm('certificate', c.id, 'Issue this certificate?', `${who}. It is issued as the request stands — check the title, printed line and photo on the website first if anything should change.`, 'Issue', said('Issued', who)), 'Issue')}
                        {declineBox('certificate', c.id, 'Decline', said('Declined', who))}
                      </>
                    ) : (
                      <AppText color="textSubtle">{notYetWords(c)}</AppText>
                    )}
                  </Card>
                );
              })
            : null}

          {show('checkin')
            ? K.map((k) => {
                const mine = ownCheckin(k, user?.id);
                const warn = rejectWarning(k);
                return (
                  <Card key={`k-${k.id}`}>
                    {head(`STAFF CHECK-IN · ${checkinDay(k).toUpperCase()}`, mine ? 'You' : k.full_name ?? 'Member of staff', checkinTime(k))}
                    <AppText color="textMuted">{checkinLine(k)}</AppText>
                    {k.review_reason ? band(k.review_reason, 'warning') : null}
                    {pills(checkinPills(k))}
                    {mine ? (
                      <AppText variant="bodyStrong" color="textSubtle">{OWN_CHECKIN_WORDS}</AppText>
                    ) : (
                      <>
                        {buttons('checkin', k.id, () => confirm('checkin', k.id, 'Accept this check-in?', `${k.full_name ?? 'Member of staff'} · ${checkinLine(k)} · ${checkinTime(k)}. The tap is kept as it is.`, 'Accept', () => checkinDoneWords(k, true)), 'Accept', 'Reject')}
                        {declineBox('checkin', k.id, 'Reject', () => checkinDoneWords(k, false))}
                        {warn ? <AppText variant="caption" color="textSubtle">{warn}</AppText> : null}
                      </>
                    )}
                  </Card>
                );
              })
            : null}

          {show('transfer')
            ? T.map((x) => {
                const who = x.from_student_name ?? 'the student';
                const warn = transferWarning(x);
                const to = x.to_student_name && x.to_student_name !== x.from_student_name ? ` (${x.to_student_name})` : '';
                return (
                  <Card key={`t-${x.id}`}>
                    {head(`PAYMENT TRANSFER · ${DAY(x.requested_at).toUpperCase()}`, who, `KD ${kdAmount(x.amount)}`)}
                    <AppText color="textMuted">{`FROM ${transferEnd(x.from_enrollment_no, x.from_course_name, x.from_branch_name)}`}</AppText>
                    <AppText color="textMuted">{`TO ${transferEnd(x.to_enrollment_no, x.to_course_name, x.to_branch_name)}${to}`}</AppText>
                    <AppText>{[x.reason ? `“${x.reason}”` : null, x.requested_by_name ? `requested by ${x.requested_by_name}` : null].filter(Boolean).join(' · ')}</AppText>
                    {warn ? band(warn, 'danger') : null}
                    {buttons('transfer', x.id, () => confirm('transfer', x.id, 'Approve this transfer?', `KD ${kdAmount(x.amount)} from ${x.from_enrollment_no ?? 'one enrolment'} to ${x.to_enrollment_no ?? 'the other'}. The money moves now.${warn ? ` ${warn}` : ''}`, 'Approve', (a) => transferDoneWords(x, !!a.withdrawal)), 'Approve', 'Reject')}
                    {declineBox('transfer', x.id, 'Reject', said('Rejected', who))}
                    <AppText variant="caption" color="textSubtle">The money moves when you approve.</AppText>
                  </Card>
                );
              })
            : null}

          {show('book')
            ? B.map((b) => {
                const who = b.student_name ?? 'the student';
                const stocked = bookInStock(b);
                return (
                  <Card key={`b-${b.id}`}>
                    {head(`FREE BOOK · ${DAY(b.approval_requested_at).toUpperCase()}`, who, `KD ${kdAmount(b.sale_price)}`)}
                    <AppText color="textMuted">{[b.book_title, b.course_name, b.branch_name].filter(Boolean).join(' · ')}</AppText>
                    {bookFeeLine(b) ? <AppText>{`Fee: ${bookFeeLine(b)}`}</AppText> : null}
                    {bookRuleLine(b) ? <AppText>{`Free rule: ${bookRuleLine(b)}`}</AppText> : null}
                    {pills([stockPill(b)])}
                    {b.requested_by_name ? <AppText color="textMuted">{`requested by ${b.requested_by_name}`}</AppText> : null}
                    {buttons('book', b.id, () => confirm('book', b.id, 'Give this book free?', `${b.book_title ?? 'The book'} to ${who}. It is handed over free and taken out of stock.`, 'Approve', () => bookDoneWords(b), b.enrollment_id), 'Approve', 'Reject', !stocked)}
                    {declineBox('book', b.id, 'Reject', said('Rejected', who), b.enrollment_id)}
                    {stocked ? (
                      <AppText variant="caption" color="textSubtle">Approving hands the book over free and takes it out of stock.</AppText>
                    ) : (
                      <AppText variant="bodyStrong" color="onDangerSoft">{OUT_OF_STOCK_WORDS}</AppText>
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 4 },
  band: { paddingHorizontal: 12, paddingVertical: 10 },
  figure: { flex: 1, borderWidth: 1, padding: 10, gap: 2 },
});
