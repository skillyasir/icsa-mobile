import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ams } from '@/api/client';
import { PressKey } from '@/api/idempotency';
import { pathFor } from '@/api/paths';
import { formatTime, kd, kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { STUDENTS_API, type StudentRow } from '@/teacher/students';
import { useAppTheme } from '@/theme/useAppTheme';

import { MONEY_API, houseDay, methodById, methodsPath, nextInstalment, owing, paymentBody, settlePress, validatePayment, type Method, type Summary } from './money';
import { ProofField } from './ProofField';
import { ReceiptButton } from './ReceiptButton';
import { StudentPick } from './StudentPick';
import { BackLink, Chips, Label } from './ui';

// Take a payment (mockups 10 and 11, approved 3 Nov 2026; built 14 Nov 2026).
// POST /payments with this press's Idempotency-Key (AMS S5): a retry on a weak
// signal cannot record the payment twice. The AMS allocates it oldest
// instalment first (its waterfall) — the phone never decides where it goes,
// and every balance shown is the AMS's payment summary, read again after.

type Student = StudentRow & { branch_id: string | null };
type Recorded = { amount: string; method: string; at: Date };

export function TakePaymentScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string; enrollmentId?: string }>();
  const { user } = useSession();
  const live = !user?.preview;
  const [studentId, setStudentId] = useState<string | null>(params.studentId ?? null);
  const one = useAmsGet<{ student: Student }>(pathFor(STUDENTS_API.one.path, { id: studentId ?? '' }), live && !!studentId);
  const fees = useAmsGet<Summary>(pathFor(STUDENTS_API.fees.path, { student_id: studentId ?? '' }), live && !!studentId);
  const student = one.data?.student ?? null;
  const branchId = student?.branch_id ?? user?.branch_id ?? null;
  const methods = useAmsGet<{ payment_methods: Method[] }>(methodsPath(branchId ?? ''), live && !!branchId);

  const open = owing(fees.data);
  const [chosen, setChosen] = useState<string | null>(params.enrollmentId ?? null);
  const enrolment = open.find((e) => e.enrollment_id === chosen) ?? (open.length === 1 ? open[0] : null);
  const next = nextInstalment(enrolment);
  const [which, setWhich] = useState<'next' | 'balance' | 'other'>('next');
  const [other, setOther] = useState('');
  const [methodId, setMethodId] = useState('');
  const [refNo, setRefNo] = useState('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null);
  const [done, setDone] = useState<Recorded | null>(null);
  const today = kuwaitDay(new Date()) ?? '';

  const allMethods = methods.data?.payment_methods ?? [];
  const method = methodById(allMethods, methodId);
  const amount = which === 'other' ? other.trim() : which === 'balance' || !next ? enrolment?.balance ?? '' : next.left;

  const press = useRef(new PressKey());
  useEffect(() => {
    press.current.reset();
  }, [studentId, chosen, which, other, methodId, refNo, proofUrl]);

  const record = async () => {
    setMessage(null);
    if (!student || !enrolment) return;
    const err = validatePayment({ amount, paymentMethodId: methodId, requiresProof: !!method?.requires_proof, proofUrl });
    if (err) return setMessage({ tone: 'warning', text: err });
    if (Number(amount) - Number(enrolment.balance) > 0.0005) return setMessage({ tone: 'warning', text: `That is more than the balance (KD ${kd(enrolment.balance)}).` });
    const body = paymentBody({
      studentId: student.id,
      enrollmentId: enrolment.enrollment_id,
      amount,
      paymentMethodId: methodId,
      proofUrl,
      referenceNo: method?.requires_reference ? refNo.trim() : undefined,
      transactionDate: method?.requires_reference ? today : undefined,
    });
    setBusy(true);
    try {
      const r = await ams.request('POST', MONEY_API.pay.path, body, { idempotencyKey: press.current.current() });
      const a = settlePress(press.current, r);
      if (!a.ok) return setMessage({ tone: a.checkRecord ? 'warning' : 'danger', text: a.message });
      setDone({ amount: kd(amount), method: method?.name ?? '', at: new Date() });
      await fees.reload();
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setDone(null);
    setWhich('next');
    setOther('');
    setRefNo('');
    setProofUrl(null);
    setMessage(null);
  };

  if (done && enrolment) {
    const now = fees.data?.enrollments.find((e) => e.enrollment_id === enrolment.enrollment_id) ?? enrolment;
    return (
      <Screen title="Payment recorded" top={<BackLink fallback="/reception/new" />}>
        <Card>
          <AppText variant="title" color="success">{`KD ${done.amount}`}</AppText>
          <AppText color="textMuted">{[done.method, `${houseDay(kuwaitDay(done.at))}, ${formatTime(done.at)}`, student?.full_name].filter(Boolean).join(' · ')}</AppText>
          <Label>ENROLMENT</Label>
          <AppText>{[now.enrollment_no, now.course_name].filter(Boolean).join(' · ')}</AppText>
          <Label>BALANCE NOW</Label>
          <AppText variant="bodyStrong">{Number(now.balance) > 0.0005 ? `KD ${kd(now.balance)}` : 'Paid in full'}</AppText>
          <ReceiptButton enrollmentId={enrolment.enrollment_id} enrollmentNo={enrolment.enrollment_no} />
          <Button title="Done" variant="outline" onPress={() => router.replace('/reception/new')} />
          {Number(now.balance) > 0.0005 ? <Button title="Take another payment" variant="outline" onPress={again} /> : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Take a payment" top={<BackLink fallback="/reception/new" />} refreshing={fees.refreshing} onRefresh={studentId ? fees.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : !studentId ? (
        <StudentPick onPick={setStudentId} />
      ) : (one.loading && !student) || (fees.loading && !fees.data) ? (
        <Loading what="Loading the fees…" />
      ) : one.failure && !student ? (
        <LoadFailed failure={one.failure} onRetry={one.refresh} />
      ) : fees.failure && !fees.data ? (
        <LoadFailed failure={fees.failure} onRetry={fees.refresh} />
      ) : (
        <>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <Card>
            <AppText variant="headline">{student?.full_name ?? 'Student'}</AppText>
            <AppText variant="caption" color="textSubtle">
              {[student?.student_code, enrolment?.enrollment_no, enrolment?.course_name].filter(Boolean).join(' · ')}
            </AppText>
            {enrolment ? (
              <>
                <Label>{next ? `BALANCE · NEXT DUE ${houseDay(kuwaitDay(next.due)).toUpperCase()}` : 'BALANCE'}</Label>
                <AppText variant="title">{`KD ${kd(enrolment.balance)}`}</AppText>
              </>
            ) : null}
          </Card>
          {open.length === 0 ? (
            <Card>
              <AppText color="textMuted">Nothing is owed on this student’s enrolments.</AppText>
              <Button title="Enrol in a course" variant="outline" onPress={() => router.replace({ pathname: '/enrol', params: { studentId: studentId ?? '' } })} />
            </Card>
          ) : null}
          {open.length > 1 ? (
            <Card>
              <Label>WHICH COURSE</Label>
              <Chips options={open.map((e) => ({ value: e.enrollment_id, label: `${e.course_name ?? e.enrollment_no ?? 'Course'} · KD ${kd(e.balance)}` }))} value={enrolment?.enrollment_id ?? null} onChange={setChosen} />
            </Card>
          ) : null}
          {enrolment ? (
            <Card>
              <Label>AMOUNT (KD)</Label>
              <Chips
                options={[
                  ...(next ? [{ value: 'next' as const, label: `Instalment ${next.no} · ${next.left}` }] : []),
                  { value: 'balance' as const, label: `Balance · ${kd(enrolment.balance)}` },
                  { value: 'other' as const, label: 'Other amount' },
                ]}
                value={!next && which === 'next' ? 'balance' : which}
                onChange={setWhich}
              />
              {which === 'other' ? <TextField label="Amount (KD)" value={other} onChangeText={setOther} keyboardType="decimal-pad" placeholder="0.000" /> : null}
              <Label>METHOD</Label>
              {methods.failure ? <LoadFailed failure={methods.failure} onRetry={methods.refresh} stale={!!methods.data} /> : null}
              <Chips options={allMethods.map((m) => ({ value: m.id, label: m.name }))} value={methodId || null} onChange={setMethodId} />
              {method?.requires_reference ? (
                <View style={{ gap: t.space.sm }}>
                  <TextField label="Transaction no." value={refNo} onChangeText={setRefNo} autoCorrect={false} />
                  <AppText variant="caption" color="textSubtle">{`Paid on ${houseDay(today)}`}</AppText>
                </View>
              ) : null}
              {method?.requires_proof ? <ProofField url={proofUrl} onChange={setProofUrl} required /> : null}
              <Button title={amount && Number(amount) > 0 ? `Record KD ${kd(amount)}` : 'Record the payment'} variant="success" busy={busy} disabled={busy} onPress={record} />
              <AppText variant="caption" color="textSubtle">Needs a connection — a payment is never saved offline.</AppText>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
