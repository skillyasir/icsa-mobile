import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ams } from '@/api/client';
import { PressKey } from '@/api/idempotency';
import { kuwaitDay } from '@/attendance/rules';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  COUNTRIES,
  EMPTY_REGISTER,
  MONEY_API,
  NATIONALITIES,
  dialPrefix,
  duplicatesPath,
  houseDay,
  parseHouseDate,
  settlePress,
  registerBody,
  type DuplicateMatch,
  type RegisterForm,
} from './money';
import { BackLink, Chips, Label, OptionSearch } from './ui';

// Register a student (mockup 09, approved 3 Nov 2026; built 14 Nov 2026).
// Yasir ruled, 14 Nov 2026: NO Civil ID scan in the app — the details are
// typed in. Step 1 Identity, step 2 Contact, then Enrol (its own screen).
// POST /students carries this press's Idempotency-Key (AMS S5); the AMS
// checks every required field again and its refusal is shown as it says it.

type Done = { id: string; code: string | null; name: string };

export function RegisterScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const branchId = user?.branch_id ?? null;
  const [f, setF] = useState<RegisterForm>(EMPTY_REGISTER);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  // The answer is kept with the question it answers, so a stale answer is never shown for new details.
  const [dupAnswer, setDupAnswer] = useState<{ path: string; matches: DuplicateMatch[] } | null>(null);
  const press = useRef(new PressKey());
  // A changed form is a different press: its old key would replay the old answer.
  useEffect(() => {
    press.current.reset();
  }, [f]);

  const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) => setF((x) => ({ ...x, [k]: v }));

  // Picking a residence fills the phone boxes with its prefix while they are still empty (the website's applyResidenceChange).
  const setResidence = (c: string) =>
    setF((x) => {
      const old = dialPrefix(x.country_of_residence).trim();
      const next = dialPrefix(c);
      const swap = (v: string) => (!v.trim() || v.trim() === old ? next : v);
      return { ...x, country_of_residence: c, phone: swap(x.phone), whatsapp: swap(x.whatsapp), emergency_contact_phone: swap(x.emergency_contact_phone) };
    });

  // Already registered? The website's duplicate check, by email and phone, a moment after typing stops.
  const dupPath = step === 2 ? duplicatesPath(f.email, f.phone) : null;
  useEffect(() => {
    if (!dupPath) return;
    let live = true;
    const timer = setTimeout(async () => {
      const r = await ams.request<{ matches: DuplicateMatch[] }>('GET', dupPath);
      if (live && r.ok) setDupAnswer({ path: dupPath, matches: r.value.matches ?? [] });
    }, 500);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [dupPath]);

  const dupes = dupPath && dupAnswer?.path === dupPath ? dupAnswer.matches : [];
  const dob = parseHouseDate(f.date_of_birth);
  const identityReady = !!f.full_name.trim() && !!f.national_id.trim() && !!dob && !!f.nationality;

  const register = async () => {
    setMessage(null);
    if (!branchId) return setMessage({ tone: 'danger', text: 'Your account has no branch, so a student cannot be registered from it. Ask a manager.' });
    const { body, problem } = registerBody(f, branchId);
    if (problem) return setMessage({ tone: 'warning', text: problem });
    setBusy(true);
    try {
      const r = await ams.request<{ student?: { id: string; student_code?: string } }>('POST', MONEY_API.register.path, body, { idempotencyKey: press.current.current() });
      const a = settlePress(press.current, r);
      if (!a.ok) return setMessage({ tone: a.checkRecord ? 'warning' : 'danger', text: a.message });
      const s = a.value.student;
      if (!s?.id) return setMessage({ tone: 'danger', text: 'The AMS saved the student but did not say who — open Students and search for them.' });
      setDone({ id: s.id, code: s.student_code ?? null, name: body.full_name });
    } finally {
      setBusy(false);
    }
  };

  const top =
    step === 2 ? (
      <Pressable accessibilityRole="link" hitSlop={12} style={{ alignSelf: 'flex-start' }} onPress={() => setStep(1)}>
        <AppText variant="bodyStrong" color="link">
          ‹ Identity
        </AppText>
      </Pressable>
    ) : (
      <BackLink fallback="/reception/new" />
    );

  if (done) {
    return (
      <Screen title="Student registered" top={<BackLink fallback="/reception/new" />}>
        <Card>
          <AppText variant="title">{done.name}</AppText>
          {done.code ? <AppText color="textMuted">{done.code}</AppText> : null}
          <AppText>Registered today, {houseDay(kuwaitDay(new Date()))}. Enrol them in a course next — the fee and the first payment are taken there.</AppText>
          <Button title="Enrol in a course" variant="primary" onPress={() => router.replace({ pathname: '/enrol', params: { studentId: done.id } })} />
          <Button title="Open the student" variant="outline" onPress={() => router.replace({ pathname: '/reception/students/profile', params: { id: done.id } })} />
          <Button title="Done" variant="outline" onPress={() => router.replace('/reception/new')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Register a student" eyebrow={step === 1 ? 'Step 1 of 3 · Identity' : 'Step 2 of 3 · Contact'} top={top}>
      {!user?.preview && !branchId ? <Notice tone="danger">Your account has no branch, so a student cannot be registered from it. Ask a manager.</Notice> : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {step === 1 ? (
        <Card>
          <AppText color="textMuted">Type the details from the Civil ID or passport.</AppText>
          <TextField label="Full name (as on the ID)" value={f.full_name} onChangeText={(v) => set('full_name', v)} autoCapitalize="words" autoCorrect={false} />
          <TextField label="Civil ID number" value={f.national_id} onChangeText={(v) => set('national_id', v)} keyboardType="number-pad" autoCorrect={false} />
          <TextField label="Date of birth" value={f.date_of_birth} onChangeText={(v) => set('date_of_birth', v)} placeholder="14 Nov 1995" autoCorrect={false} />
          {f.date_of_birth.trim() ? (
            <AppText variant="caption" color={dob ? 'success' : 'onDangerSoft'}>
              {dob ? `✓ ${houseDay(dob)}` : 'Type it as 14 Nov 1995'}
            </AppText>
          ) : null}
          <OptionSearch label="Nationality" value={f.nationality} options={NATIONALITIES} onChange={(v) => set('nationality', v)} />
          <Label>GENDER</Label>
          <Chips options={[{ value: 'Female', label: 'Female' }, { value: 'Male', label: 'Male' }]} value={f.gender || null} onChange={(v) => set('gender', v)} />
          <Button title="Continue — contact details" variant="primary" disabled={!identityReady} onPress={() => { setMessage(null); setStep(2); }} />
          {!identityReady ? <AppText variant="caption" color="textSubtle">Name, Civil ID, date of birth and nationality are needed to go on.</AppText> : null}
        </Card>
      ) : (
        <Card>
          <View style={{ gap: t.space.xs }}>
            <AppText variant="headline">{f.full_name.trim()}</AppText>
            <AppText variant="caption" color="textSubtle">
              {[f.national_id.trim(), dob ? houseDay(dob) : null, f.nationality].filter(Boolean).join(' · ')}
            </AppText>
            <Button title="Edit identity" variant="outline" onPress={() => setStep(1)} />
          </View>
          <OptionSearch label="Country of residence" value={f.country_of_residence} options={COUNTRIES} onChange={setResidence} />
          <TextField label="Mobile" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" autoCorrect={false} />
          <TextField label="WhatsApp (if different)" value={f.whatsapp} onChangeText={(v) => set('whatsapp', v)} keyboardType="phone-pad" autoCorrect={false} />
          <TextField label="Email (the student signs in with it)" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          {dupes.length > 0 ? (
            <Notice tone="warning" title="Already registered?">
              {dupes.map((d) => `${d.full_name} · ${d.student_code}${d.branch_name ? ` · ${d.branch_name}` : ''}`).join('\n') + '\nThis email or phone is on that record. Check before registering again.'}
            </Notice>
          ) : dupPath && dupAnswer?.path === dupPath ? (
            <AppText variant="caption" color="textSubtle">No existing student has this email or phone.</AppText>
          ) : null}
          <TextField label="Emergency contact name" value={f.emergency_contact_name} onChangeText={(v) => set('emergency_contact_name', v)} autoCapitalize="words" />
          <TextField label="Emergency contact phone" value={f.emergency_contact_phone} onChangeText={(v) => set('emergency_contact_phone', v)} keyboardType="phone-pad" />
          <TextField label="Address" value={f.address} onChangeText={(v) => set('address', v)} placeholder="Area, block, street, building" />
          <Button title="Register the student" variant="primary" busy={busy} disabled={busy || !branchId} onPress={register} />
          <AppText variant="caption" color="textSubtle">Needs a connection — a registration is never saved offline. Photos, area and marketer are added on the website.</AppText>
        </Card>
      )}
    </Screen>
  );
}
