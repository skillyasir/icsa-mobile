import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams, DEVICE } from '@/api/client';
import { BranchMap } from '@/attendance/BranchMap';
import { openSettings, readFix } from '@/attendance/location';
import {
  ATTENDANCE_API,
  LOCATION_MESSAGES,
  canChangeTeacher,
  changeUndoesMark,
  checkInBody,
  checkInLabel,
  checkOutBody,
  classTimes,
  distanceLine,
  formatTime,
  locationPlan,
  mapBranch,
  myTeacherBody,
  placeLabel,
  statusView,
  type Fix,
} from '@/attendance/rules';
import { checkInTeacher, todayClasses, type TodayClass } from '@/attendance/today';
import type { CheckInAnswer, MyContext, Teacher } from '@/attendance/types';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// Check in (Phase 2 piece 1, mockup 02, 6 Nov 2026). Reached from Home's
// Check in button (with start=1: that tap IS the check-in, so it begins at
// once) or from the Attendance tab. The AMS decides the check-in; this screen
// reads the position when asked, sends it, and shows what the AMS answered.

const PRECISE_HINT =
  'Precise location is off for ICSA. Turn it on in Settings › ICSA › Location, then try again.';

type Busy = null | 'locating' | 'sending' | 'checkout' | 'teacher';

export function CheckInScreen() {
  const { enrollment, start } = useLocalSearchParams<{ enrollment?: string; start?: string }>();
  const router = useRouter();
  const t = useAppTheme();
  const { user } = useSession();
  const preview = !!user?.preview;
  const ctx = useAmsGet<MyContext>(ATTENDANCE_API.context.path, !preview);

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ text: string; settings?: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [askOnline, setAskOnline] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [answer, setAnswer] = useState<CheckInAnswer | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [changing, setChanging] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const started = useRef(false);

  const cls = todayClasses(ctx.data).find((c) => c.enrollmentId === enrollment) ?? null;

  const send = async (c: TodayClass, f: Fix | null, approximate: boolean) => {
    setBusy('sending');
    setAskOnline(null); // the student chose: Online, or a position
    setError(null);
    setHint(null);
    const teacher = checkInTeacher(c, chosen);
    const r = await ams.request<CheckInAnswer>(
      'POST',
      ATTENDANCE_API.checkIn.path,
      checkInBody({ enrollmentId: c.enrollmentId, fix: f, teacherId: teacher?.id ?? null, platform: DEVICE.platform }),
    );
    if (!r.ok) {
      setBusy(null);
      setError({ text: r.failure.message });
      if (approximate) setHint(PRECISE_HINT);
      return;
    }
    setFix(f);
    setAnswer(r.value);
    setPicking(false);
    await ctx.reload();
    setBusy(null);
  };

  const checkIn = async (c: TodayClass) => {
    setError(null);
    setHint(null);
    setAskOnline(null);
    setTold(null);
    if (c.kind === 'individual' && !checkInTeacher(c, chosen)) {
      setPicking(true);
      setError({ text: 'Choose your teacher, then tap Check in.' });
      return;
    }
    const plan = locationPlan(c.mode);
    if (plan === 'none') return send(c, null, false);
    setBusy('locating');
    const got = await readFix();
    if (!got.ok) {
      setBusy(null);
      // Hybrid: no position means Online — asked first, never silently.
      if (plan === 'asked') setAskOnline(LOCATION_MESSAGES[got.why]);
      else setError({ text: LOCATION_MESSAGES[got.why], settings: got.settings });
      return;
    }
    return send(c, got.fix, got.approximate);
  };

  // From Home's Check in button: that tap was the check-in, so begin once the
  // class is known. Only once per visit, and never for a class already done.
  useEffect(() => {
    if (start !== '1' || started.current || !cls) return;
    started.current = true;
    router.setParams({ start: undefined });
    if (cls.open) Promise.resolve().then(() => checkIn(cls));
  });

  const checkOut = (c: TodayClass) => {
    Alert.alert('Check out?', 'This records the time you left class.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Check out',
        onPress: async () => {
          setError(null);
          setBusy('checkout');
          const r = await ams.request('POST', ATTENDANCE_API.checkOut.path, checkOutBody(c.enrollmentId));
          if (!r.ok) setError({ text: r.failure.message });
          await ctx.reload();
          setBusy(null);
        },
      },
    ]);
  };

  const changeTeacher = (c: TodayClass, to: Teacher) => {
    const a = c.todays;
    if (!a) return;
    const current = c.teacher?.name ?? 'Your teacher';
    const go = async () => {
      setError(null);
      setBusy('teacher');
      const r = await ams.request<{ message?: string }>('POST', ATTENDANCE_API.myTeacher.path, myTeacherBody(a.id, to.id));
      if (!r.ok) {
        setBusy(null);
        setError({ text: r.failure.message });
        return;
      }
      setChanging(false);
      setTold(r.value.message ?? `Changed to ${to.name}.`);
      await ctx.reload();
      setBusy(null);
    };
    if (!changeUndoesMark(a.status)) {
      go();
      return;
    }
    Alert.alert(
      'Change your teacher?',
      `${current} has already marked you ${a.status}. If you change to ${to.name}, your attendance goes back to waiting, and ${to.name} confirms it today.`,
      [
        { text: `Keep ${current}`, style: 'cancel' },
        { text: 'Change teacher', onPress: go },
      ],
    );
  };

  const back = (
    <Pressable
      accessibilityRole="link"
      hitSlop={12}
      style={styles.back}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/student/attendance'))}
    >
      <AppText variant="bodyStrong" color="link">
        ‹ Attendance
      </AppText>
    </Pressable>
  );

  return (
    <Screen title="Check in" top={back} refreshing={ctx.refreshing} onRefresh={preview ? undefined : ctx.refresh}>
      {preview ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there is no class to check in to.
        </Notice>
      ) : ctx.loading && !ctx.data ? (
        <Loading what="Loading your class…" />
      ) : ctx.failure && !ctx.data ? (
        <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} />
      ) : !cls ? (
        <Card>
          <AppText variant="headline">This class is not on your list today</AppText>
          <AppText color="textMuted">It may have ended or been paused. Your classes are on the Attendance tab.</AppText>
        </Card>
      ) : (
        <ClassCheckIn
          cls={cls}
          ctx={ctx.data}
          fix={fix}
          answer={answer}
          busy={busy}
          chosen={chosen}
          picking={picking}
          changing={changing}
          onPick={(id) => {
            setChosen(id);
            setPicking(false);
            setError(null);
          }}
          onTogglePicking={() => setPicking((p) => !p)}
          onToggleChanging={() => setChanging((p) => !p)}
          onCheckIn={() => checkIn(cls)}
          onCheckOut={() => checkOut(cls)}
          onChange={(to) => changeTeacher(cls, to)}
        />
      )}

      {ctx.failure && ctx.data ? <LoadFailed failure={ctx.failure} onRetry={ctx.refresh} stale /> : null}

      {askOnline && cls && !cls.todays ? (
        <View style={{ gap: t.space.sm }}>
          <Notice tone="warning" title="We couldn't read your location">
            {`${askOnline} If you are at the branch, allow location and try again. Otherwise you can check in as Online.`}
          </Notice>
          <Button title="Check in as Online" onPress={() => send(cls, null, false)} busy={busy === 'sending'} />
          <Button title="Try again" variant="outline" onPress={() => checkIn(cls)} disabled={busy !== null} />
        </View>
      ) : null}

      {error ? (
        <View style={{ gap: t.space.sm }}>
          <Notice tone="danger">{error.text}</Notice>
          {error.settings ? <Button title="Open Settings" variant="outline" onPress={openSettings} /> : null}
        </View>
      ) : null}
      {hint ? (
        <View style={{ gap: t.space.sm }}>
          <Notice tone="info">{hint}</Notice>
          <Button title="Open Settings" variant="outline" onPress={openSettings} />
        </View>
      ) : null}
      {told ? <Notice tone="success">{told}</Notice> : null}

      <AppText variant="caption" color="textSubtle">
        ICSA reads your location only when you tap Check in, to confirm you are at a branch. It is never tracked in the
        background.
      </AppText>
    </Screen>
  );
}

function ClassCheckIn(props: {
  cls: TodayClass;
  ctx: MyContext | null;
  fix: Fix | null;
  answer: CheckInAnswer | null;
  busy: Busy;
  chosen: string | null;
  picking: boolean;
  changing: boolean;
  onPick: (id: string) => void;
  onTogglePicking: () => void;
  onToggleChanging: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onChange: (to: Teacher) => void;
}) {
  const { cls, ctx, fix, answer, busy, chosen, picking, changing } = props;
  const t = useAppTheme();
  const a = cls.todays;
  const plan = locationPlan(cls.mode);
  const branches = ctx?.branches ?? [];
  const focus = mapBranch(branches, a?.attended_branch_id ?? answer?.attended_branch?.id);
  // The map, wherever a position decides the check-in — not for a class that
  // is online, or a hybrid check-in that was recorded Online.
  const showMap = plan !== 'none' && a?.attendance_mode !== 'online' && !!focus;
  const teacher = cls.kind === 'individual' && !a ? checkInTeacher(cls, chosen) : cls.teacher;
  const others = a ? cls.teachers.filter((x) => x.id !== a.teacher_id) : [];
  const times = classTimes(cls.start, cls.end);

  return (
    <View style={{ gap: t.space.lg }}>
      {showMap && focus ? <BranchMap branches={branches} focus={focus} fix={a ? fix : null} /> : null}

      <Card>
        {a ? (
          <View style={styles.headRow}>
            <View style={[styles.tick, { backgroundColor: t.colors.successSoft }]}>
              <AppText variant="title" color="onSuccessSoft">
                ✓
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="title">{a.attendance_mode === 'online' ? "You're marked in" : "You're checked in"}</AppText>
              <AppText variant="caption" color="textMuted">
                {[
                  formatTime(a.check_in_time),
                  a.attendance_mode === 'online'
                    ? 'Online'
                    : distanceLine(
                        a.check_in_distance_m ?? answer?.distance_m,
                        a.check_in_accuracy_m ?? answer?.accuracy_m,
                        placeLabel(a.attendance_mode, a.attended_branch_name),
                      ),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={{ gap: t.space.xs }}>
            <AppText variant="title">{cls.course}</AppText>
            <AppText variant="caption" color="textMuted">
              {[cls.group, times].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        )}

        {a ? <Detail label="Class" value={cls.course} /> : null}
        <Detail label="Teacher" value={teacher?.name ?? (cls.kind === 'individual' ? 'Choose your teacher' : '—')} />

        {/* Before checking in, an individual student may pick who is teaching them today. */}
        {!a && cls.kind === 'individual' && (cls.teachers.length > 1 || (!teacher && cls.teachers.length > 0)) ? (
          <LinkRow text={picking ? 'Done' : teacher ? 'Choose another teacher' : 'Choose your teacher'} onPress={props.onTogglePicking} />
        ) : null}
        {!a && picking ? (
          <Choices teachers={cls.teachers} selected={teacher?.id ?? null} onPick={(x) => props.onPick(x.id)} />
        ) : null}

        {/* Wrong teacher? Change — today only (Yasir, 1 Nov 2026). */}
        {a && canChangeTeacher(a) && others.length > 0 ? (
          <LinkRow text={changing ? 'Cancel' : 'Wrong teacher? Change'} onPress={props.onToggleChanging} />
        ) : null}
        {a && changing ? (
          <Choices teachers={others} selected={null} onPick={props.onChange} disabled={busy === 'teacher'} />
        ) : null}

        {a ? (
          <Notice tone={statusView(a.status, a.attendance_mode, cls.teacher?.name ?? null).tone}>
            {statusView(a.status, a.attendance_mode, cls.teacher?.name ?? null).text}
          </Notice>
        ) : null}
        {answer?.hybrid_note && a?.attendance_mode === 'online' ? (
          <Notice tone="info">{answer.hybrid_note}</Notice>
        ) : null}

        {!a && answer ? (
          // Checked in, but the fresh list has not arrived (a weak signal): say so,
          // and offer no second check-in.
          <Notice tone="success">{answer.message}</Notice>
        ) : !a ? (
          cls.open ? (
            <Button
              title={busy === 'locating' ? 'Finding your location…' : checkInLabel(cls.mode)}
              busy={busy === 'locating' || busy === 'sending'}
              onPress={props.onCheckIn}
            />
          ) : (
            <Notice tone="info">{cls.note ?? 'Check-in is not open.'}</Notice>
          )
        ) : a.check_out_time ? (
          <AppText variant="caption" color="textMuted">
            {`Checked out at ${formatTime(a.check_out_time)}`}
          </AppText>
        ) : (
          <Button title="Check out when class ends" variant="outline" busy={busy === 'checkout'} onPress={props.onCheckOut} />
        )}
      </Card>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText color="textSubtle">{label}</AppText>
      <AppText variant="bodyStrong" style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

function LinkRow({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.link}>
      <AppText variant="bodyStrong" color="link" style={styles.underline}>
        {text}
      </AppText>
    </Pressable>
  );
}

function Choices({
  teachers,
  selected,
  onPick,
  disabled = false,
}: {
  teachers: Teacher[];
  selected: string | null;
  onPick: (t: Teacher) => void;
  disabled?: boolean;
}) {
  const t = useAppTheme();
  return (
    <View style={[styles.choices, { borderColor: t.colors.border, borderRadius: t.radius.md }]}>
      {teachers.map((x, i) => (
        <Pressable
          key={x.id}
          accessibilityRole="radio"
          accessibilityState={{ selected: x.id === selected, disabled }}
          disabled={disabled}
          onPress={() => onPick(x)}
          style={({ pressed }) => [
            styles.choice,
            { borderTopColor: t.colors.border, borderTopWidth: i === 0 ? 0 : 1 },
            pressed && { backgroundColor: t.colors.surfaceMuted },
          ]}
        >
          <AppText variant={x.id === selected ? 'bodyStrong' : 'body'} style={styles.flex}>
            {x.name}
            {x.is_default ? '  (assigned)' : ''}
          </AppText>
          {x.id === selected ? (
            <AppText variant="bodyStrong" color="link">
              ✓
            </AppText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tick: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { flex: 1, textAlign: 'right' },
  link: { alignSelf: 'flex-end', minHeight: minTouch, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  choices: { borderWidth: 1, overflow: 'hidden' },
  choice: { minHeight: minTouch + 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
});
