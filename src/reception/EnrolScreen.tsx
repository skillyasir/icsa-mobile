import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ams } from '@/api/client';
import { PressKey } from '@/api/idempotency';
import { pathFor } from '@/api/paths';
import { formatClock, kd, kuwaitDay } from '@/attendance/rules';
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

import {
  DAYS,
  DELIVERY_MODES,
  MONEY_API,
  buildInstallmentItems,
  enrolBody,
  houseDay,
  methodById,
  methodsPath,
  parseClock,
  parseHouseDate,
  settlePress,
  validateEnrollment,
  validatePayment,
  type DeliveryMode,
  type Method,
  type PaymentPlan,
} from './money';
import { ProofField } from './ProofField';
import { ReceiptButton } from './ReceiptButton';
import { StudentPick } from './StudentPick';
import { BackLink, Chips, Label, MultiChips } from './ui';

// Enrol a student (Reception 2b, 14 Nov 2026) — the AMS's enrolment sequence in
// ONE transaction: POST /enrollments/full writes the enrolment, the fee plan
// and the first payment together, or nothing (enrollmentFullController). One
// press, one key (AMS S5), so a retry on a weak signal cannot enrol twice or
// take the first payment twice. The body is enrollmentFlow's runEnrollmentFull
// body (money.ts; money.check runs the AMS's own beside it).
//
// The batch rule (AMS CLAUDE.md): an enrolment may ASSIGN an existing batch; it
// never creates one. With no batch the student's own days and time ride on the
// enrolment. No discount or coupon in the app — those stay on the website.

type Course = { id: string; name: string; fee: string | number | null };
type Batch = { id: string; batch_name: string | null; days_of_week: string | null; start_time: string | null; end_time: string | null; start_date: string | null; is_active?: boolean };
type Teacher = { id: string; full_name: string };
type Student = StudentRow & { branch_id: string | null };
type Enrolled = { id: string; enrollment_no: string | null };
type Created = { enrollment?: Enrolled; plan?: unknown; transaction?: { amount?: string | number } | null };

const NO_BATCH = '__none__';

export function EnrolScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const { user } = useSession();
  const live = !user?.preview;
  const [studentId, setStudentId] = useState<string | null>(params.studentId ?? null);
  const today = kuwaitDay(new Date()) ?? '';

  const one = useAmsGet<{ student: Student }>(pathFor(STUDENTS_API.one.path, { id: studentId ?? '' }), live && !!studentId);
  const student = one.data?.student ?? null;
  const branchId = student?.branch_id ?? user?.branch_id ?? null;
  const courses = useAmsGet<{ courses: Course[] }>(`${MONEY_API.courses.path}?is_active=true&branch_id=${encodeURIComponent(branchId ?? '')}`, live && !!branchId);
  const methods = useAmsGet<{ payment_methods: Method[] }>(methodsPath(branchId ?? ''), live && !!branchId);

  const [courseId, setCourseId] = useState<string | null>(null);
  const course = (courses.data?.courses ?? []).find((c) => c.id === courseId) ?? null;
  const batches = useAmsGet<{ schedules: Batch[] }>(pathFor(MONEY_API.courseBatches.path, { id: courseId ?? '' }), live && !!courseId);
  const teachers = useAmsGet<{ teachers: Teacher[] }>(pathFor(MONEY_API.courseTeachers.path, { id: courseId ?? '' }), live && !!courseId);

  const [batch, setBatch] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hours, setHours] = useState('');
  const [mode, setMode] = useState<DeliveryMode>('face_to_face');
  const [startText, setStartText] = useState(houseDay(today));
  const [plan, setPlan] = useState<PaymentPlan>({ payment_type: '', installments: '3', installment_interval: 'monthly', paid_now: '', payment_method_id: '', method_branch_id: '', proof_url: null });
  const [refNo, setRefNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null);
  const [done, setDone] = useState<{ e: Enrolled; paid: string | null; note: string | null } | null>(null);

  const press = useRef(new PressKey());
  useEffect(() => {
    press.current.reset();
  }, [courseId, batch, teacherId, days, startTime, endTime, hours, mode, startText, plan, refNo]);

  const setP = <K extends keyof PaymentPlan>(k: K, v: PaymentPlan[K]) => setPlan((x) => ({ ...x, [k]: v }));
  const allMethods = methods.data?.payment_methods ?? [];
  const method = methodById(allMethods, plan.payment_method_id);
  const activeBatches = (batches.data?.schedules ?? []).filter((b) => b.is_active !== false);
  const individual = batch === NO_BATCH;
  const startYmd = parseHouseDate(startText);
  const fee = course?.fee != null ? Number(course.fee) : null;
  const n = plan.payment_type === 'full' ? 1 : parseInt(plan.installments) || 0;
  const preview = fee != null && plan.payment_type && n >= 1 && n <= 36 ? buildInstallmentItems({ netFee: fee, numInstallments: n, interval: plan.installment_interval }) : [];

  const pickCourse = (id: string) => {
    setCourseId(id);
    setBatch(null);
    setTeacherId(null);
    setMessage(null);
  };

  const enrol = async () => {
    setMessage(null);
    if (!student || !course) return;
    const chosenBatch = individual ? null : batch;
    const st = startTime.trim() ? parseClock(startTime) : '';
    const et = endTime.trim() ? parseClock(endTime) : '';
    if (st === null || et === null) return setMessage({ tone: 'warning', text: 'Type the class time as 4:30 PM or 16:30.' });
    if (!batch) return setMessage({ tone: 'warning', text: 'Choose a batch, or "Individual — no batch".' });
    // A course with no fee is enrolled with no plan (runEnrollmentFull: a null fee means "enrol only").
    const p: PaymentPlan = { ...plan, payment_type: fee == null ? 'full' : plan.payment_type, method_branch_id: branchId ?? '', reference_no: method?.requires_reference ? refNo.trim() : undefined, transaction_date: method?.requires_reference ? today : undefined };
    const err = validateEnrollment({
      courseId: course.id,
      selectedScheduleId: chosenBatch,
      hoursPerSession: hours,
      teacherId,
      startDate: startYmd ?? '',
      days,
      payment: p,
    });
    if (err) return setMessage({ tone: 'warning', text: err });
    if (Number(p.paid_now) > 0) {
      const pe = validatePayment({ amount: p.paid_now, paymentMethodId: p.payment_method_id, requiresProof: !!method?.requires_proof, proofUrl: p.proof_url ?? null });
      if (pe) return setMessage({ tone: 'warning', text: pe });
    }
    const { body } = enrolBody({
      studentId: student.id,
      courseId: course.id,
      selectedScheduleId: chosenBatch,
      branchId,
      enrolledDate: today,
      startDate: startYmd,
      deliveryMode: mode,
      teacherId,
      chips: { days, startTime: st || '', endTime: et || '', hoursPerSession: hours },
      courseFee: course.fee,
      payment: p,
    });
    setBusy(true);
    try {
      const r = await ams.request<Created>('POST', MONEY_API.enrol.path, body, { idempotencyKey: press.current.current() });
      const a = settlePress(press.current, r);
      if (!a.ok) return setMessage({ tone: a.checkRecord ? 'warning' : 'danger', text: a.message });
      const e = a.value.enrollment;
      if (!e?.id) return setMessage({ tone: 'danger', text: 'The AMS answered without the enrolment. Open the student before trying again.' });
      setDone({ e, paid: a.value.transaction ? kd(a.value.transaction.amount ?? p.paid_now) : null, note: a.value.plan ? null : 'No fee plan was made for this course.' });
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen title="Enrolled" top={<BackLink fallback="/reception/new" />}>
        <Card>
          <AppText variant="title">{student?.full_name ?? 'Student'}</AppText>
          <AppText color="textMuted">{[done.e.enrollment_no, course?.name].filter(Boolean).join(' · ')}</AppText>
          <AppText>{done.paid ? `First payment recorded: KD ${done.paid}.` : 'No payment was taken now.'}</AppText>
          {done.note ? <Notice tone="warning">{done.note}</Notice> : null}
          <ReceiptButton enrollmentId={done.e.id} enrollmentNo={done.e.enrollment_no} />
          <Button title="Open the student" variant="outline" onPress={() => router.replace({ pathname: '/reception/students/profile', params: { id: student?.id ?? '' } })} />
          <Button title="Done" variant="outline" onPress={() => router.replace('/reception/new')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Enrol in a course" top={<BackLink fallback="/reception/new" />}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : !studentId ? (
        <StudentPick onPick={setStudentId} />
      ) : one.loading && !student ? (
        <Loading what="Loading the student…" />
      ) : one.failure && !student ? (
        <LoadFailed failure={one.failure} onRetry={one.refresh} />
      ) : (
        <>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <Card>
            <AppText variant="headline">{student?.full_name ?? 'Student'}</AppText>
            <AppText variant="caption" color="textSubtle">
              {[student?.student_code, student?.branch_name].filter(Boolean).join(' · ')}
            </AppText>
          </Card>

          <Card>
            <Label>COURSE</Label>
            {courses.loading && !courses.data ? <Loading what="Loading the courses…" /> : null}
            {courses.failure ? <LoadFailed failure={courses.failure} onRetry={courses.refresh} stale={!!courses.data} /> : null}
            <Chips options={(courses.data?.courses ?? []).map((c) => ({ value: c.id, label: c.name }))} value={courseId} onChange={pickCourse} />
            {course ? <AppText variant="bodyStrong">Fee: {fee != null ? `KD ${kd(fee)}` : 'none set — enrolled with no fee plan'}</AppText> : null}
          </Card>

          {course ? (
            <Card>
              <Label>BATCH</Label>
              {batches.failure ? <LoadFailed failure={batches.failure} onRetry={batches.refresh} stale={!!batches.data} /> : null}
              <Chips
                options={[
                  ...activeBatches.map((b) => ({
                    value: b.id,
                    label: [b.batch_name || 'Batch', b.days_of_week, b.start_time ? formatClock(b.start_time) : null].filter(Boolean).join(' · '),
                  })),
                  { value: NO_BATCH, label: 'Individual — no batch' },
                ]}
                value={batch}
                onChange={setBatch}
              />
              <Label>{individual ? 'TEACHER' : 'TEACHER (ONLY TO CHANGE THE BATCH’S)'}</Label>
              {teachers.failure ? <LoadFailed failure={teachers.failure} onRetry={teachers.refresh} stale={!!teachers.data} /> : null}
              <Chips options={(teachers.data?.teachers ?? []).map((x) => ({ value: x.id, label: x.full_name }))} value={teacherId} onChange={setTeacherId} />
              {individual ? (
                <View style={{ gap: t.space.sm }}>
                  <Label>CLASS DAYS</Label>
                  <MultiChips options={DAYS} value={days} onChange={setDays} />
                  <TextField label="Starts at (optional)" value={startTime} onChangeText={setStartTime} placeholder="4:30 PM" autoCorrect={false} />
                  <TextField label="Ends at (optional)" value={endTime} onChangeText={setEndTime} placeholder="6:30 PM" autoCorrect={false} />
                  <TextField label="Hours per session" value={hours} onChangeText={setHours} keyboardType="decimal-pad" placeholder="2" />
                </View>
              ) : null}
              <Label>HOW THEY STUDY</Label>
              <Chips options={DELIVERY_MODES} value={mode} onChange={setMode} />
              <TextField label="Classes start" value={startText} onChangeText={setStartText} placeholder={houseDay(today)} autoCorrect={false} />
              <AppText variant="caption" color={startYmd ? 'textSubtle' : 'onDangerSoft'}>
                {startYmd ? `✓ ${houseDay(startYmd)} — today or later` : 'Type it as 14 Nov 2026'}
              </AppText>
            </Card>
          ) : null}

          {course && fee != null ? (
            <Card>
              <Label>FEE PLAN</Label>
              <Chips options={[{ value: 'full', label: 'Full' }, { value: 'installments', label: 'Instalments' }]} value={plan.payment_type || null} onChange={(v) => setP('payment_type', v)} />
              {plan.payment_type === 'installments' ? (
                <View style={{ gap: t.space.sm }}>
                  <TextField label="How many instalments (2–36)" value={plan.installments} onChangeText={(v) => setP('installments', v)} keyboardType="number-pad" />
                  <Chips options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }]} value={plan.installment_interval} onChange={(v) => setP('installment_interval', v)} />
                </View>
              ) : null}
              {preview.length > 0 ? (
                <View style={{ gap: 2 }}>
                  {preview.slice(0, 6).map((it) => (
                    <AppText key={it.installment_no} color="textMuted">
                      {`${it.installment_no}. KD ${it.scheduled_amount} · due ${houseDay(it.due_date)}`}
                    </AppText>
                  ))}
                  {preview.length > 6 ? <AppText color="textMuted">{`… ${preview.length - 6} more`}</AppText> : null}
                </View>
              ) : null}

              <Label>PAID NOW</Label>
              <TextField label="Amount (KD) — leave empty if nothing is paid now" value={plan.paid_now} onChangeText={(v) => setP('paid_now', v)} keyboardType="decimal-pad" placeholder="0.000" />
              {Number(plan.paid_now) > 0 ? (
                <View style={{ gap: t.space.sm }}>
                  <Label>METHOD</Label>
                  {methods.failure ? <LoadFailed failure={methods.failure} onRetry={methods.refresh} stale={!!methods.data} /> : null}
                  <Chips options={allMethods.map((m) => ({ value: m.id, label: m.name }))} value={plan.payment_method_id || null} onChange={(v) => setP('payment_method_id', v)} />
                  {method?.requires_reference ? <TextField label="Transaction no." value={refNo} onChangeText={setRefNo} autoCorrect={false} /> : null}
                  {method?.requires_proof ? <ProofField url={plan.proof_url ?? null} onChange={(u) => setP('proof_url', u)} required /> : null}
                </View>
              ) : null}
            </Card>
          ) : null}

          {course ? (
            <>
              <Button title={Number(plan.paid_now) > 0 ? `Enrol and record KD ${kd(plan.paid_now)}` : 'Enrol'} variant="primary" busy={busy} disabled={busy} onPress={enrol} />
              <AppText variant="caption" color="textSubtle">Needs a connection — an enrolment or a payment is never saved offline.</AppText>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
