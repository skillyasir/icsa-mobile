import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { formatTime, kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { houseDay, parseHouseDate } from '@/reception/money';
import { BackLink, Chips, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { dialable, whatsappUrl } from '@/teacher/students';
import { useAppTheme } from '@/theme/useAppTheme';

import { LEADS_API, MOVES, OUTCOMES, STAGES, WHEN_OPTIONS, logBody, offeredReasons, type ActivityRow, type Lead, type LostReason, type When } from './leads';

// One lead (mockup 14, approved 3 Nov 2026; built 14 Nov 2026): call or
// WhatsApp in one tap, where it stands, what happened so far, and logging what
// happened now. Yasir ruled, 14 Nov 2026: the AMS's four stages only. A stage
// is moved the website's way — by logging a contact that moves it to Enrolled
// or Lost (Lost needs a reason). Only the lead's owner may log (the AMS says so).

export function LeadScreen() {
  const t = useAppTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useSession();
  const live = !user?.preview && !!id;
  const one = useAmsGet<{ prospect: Lead }>(pathFor(LEADS_API.one.path, { id: id ?? '' }), live);
  const act = useAmsGet<{ activity: ActivityRow[] }>(pathFor(LEADS_API.activity.path, { id: id ?? '' }), live);
  const reasons = useAmsGet<{ reasons: LostReason[] }>(LEADS_API.lostReasons.path, live);
  const p = one.data?.prospect ?? null;
  const today = kuwaitDay(new Date()) ?? '';

  const [choice, setChoice] = useState<string>(OUTCOMES[0]);
  const [note, setNote] = useState('');
  const [when, setWhen] = useState<When>('3');
  const [picked, setPicked] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  const moving = MOVES.find((m) => m.value === choice) ?? null;
  const phone = dialable(p?.phone);
  const wa = whatsappUrl(p?.whatsapp || p?.phone);
  const open = p ? p.status === 'new' || p.status === 'contacted' : false;

  const save = async () => {
    setMessage(null);
    if (!p) return;
    const pickedYmd = when === 'pick' ? parseHouseDate(picked) : null;
    const b = logBody({ choice, note, when, picked: pickedYmd, lostReason, today });
    if (!b.ok) return setMessage({ tone: 'warning', text: b.message });
    setBusy(true);
    try {
      const r = await ams.request('POST', pathFor(LEADS_API.log.path, { id: p.id }), b.body);
      if (!r.ok) return setMessage({ tone: 'danger', text: r.failure.message });
      setMessage({ tone: 'success', text: moving ? `Saved — moved to ${moving.status === 'lost' ? 'Lost' : 'Enrolled'}.` : 'Saved.' });
      setNote('');
      setLostReason('');
      setChoice(OUTCOMES[0]);
      await Promise.all([one.reload(), act.reload()]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={p?.full_name ?? 'Lead'} top={<BackLink label="‹ My leads" fallback="/marketer" />} refreshing={one.refreshing} onRefresh={live ? one.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : one.loading && !p ? (
        <Loading what="Loading the lead…" />
      ) : one.failure && !p ? (
        <LoadFailed failure={one.failure} onRetry={one.refresh} />
      ) : p ? (
        <>
          <Card>
            <AppText color="textMuted">{[p.course_interest_name, p.branch_interest_name, p.referred_by_name ? `via ${p.referred_by_name}` : null].filter(Boolean).join(' · ') || 'No course chosen yet'}</AppText>
            {p.wrong_number_at ? <Notice tone="warning">This number was marked wrong. Check it before calling.</Notice> : null}
            <View style={[styles.row, { gap: t.space.sm }]}>
              <View style={styles.half}>
                <Button title="Call" variant="primary" disabled={!phone} onPress={() => phone && Linking.openURL(`tel:${phone}`)} />
              </View>
              <View style={styles.half}>
                <Button title="WhatsApp" variant="success" disabled={!wa} onPress={() => wa && Linking.openURL(wa)} />
              </View>
            </View>
            <AppText variant="caption" color="textSubtle">
              {[p.phone, p.whatsapp && p.whatsapp !== p.phone ? `WhatsApp ${p.whatsapp}` : null, p.crs_number ? `CRS ${p.crs_number}` : null].filter(Boolean).join(' · ')}
            </AppText>
          </Card>

          <Card>
            <Label>STAGE</Label>
            <View style={[styles.row, { gap: t.space.xs }]}>
              {STAGES.map((s) => {
                const on = p.status === s.value || (s.value === 'enrolled' && p.status === 'enrolled_refunded');
                return (
                  <View key={s.value} style={[styles.stage, { borderRadius: t.radius.pill, backgroundColor: on ? t.colors.primary : t.colors.surfaceMuted }]}>
                    <AppText variant="caption" style={{ color: on ? t.colors.onPrimary : t.colors.textMuted }}>
                      {s.label}
                    </AppText>
                  </View>
                );
              })}
            </View>
            {p.next_followup_date && open ? <AppText variant="bodyStrong">{`Next call: ${houseDay(p.next_followup_date.slice(0, 10))}`}</AppText> : null}
            {p.status === 'enrolled' && p.attributed_enrollment_no ? <AppText>{`Enrolled · ${p.attributed_enrollment_no}`}</AppText> : null}
            {p.notes ? <AppText color="textMuted">{p.notes}</AppText> : null}
          </Card>

          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          {open ? (
            <Card>
              <Label>LOG A CONTACT</Label>
              <Chips options={[...OUTCOMES.map((o) => ({ value: o as string, label: o as string })), ...MOVES.map((m) => ({ value: m.value as string, label: m.label as string }))]} value={choice} onChange={setChoice} />
              <TextField label="Note — what was said" value={note} onChangeText={setNote} multiline placeholder="Wants the evening batch — after work" />
              {moving?.status === 'lost' ? (
                <View style={{ gap: t.space.sm }}>
                  <Label>WHY IT WAS LOST</Label>
                  {reasons.failure ? <LoadFailed failure={reasons.failure} onRetry={reasons.refresh} stale={!!reasons.data} /> : null}
                  <Chips options={offeredReasons(reasons.data?.reasons).map((r) => ({ value: r.key, label: r.label }))} value={lostReason || null} onChange={setLostReason} />
                </View>
              ) : moving ? null : (
                <View style={{ gap: t.space.sm }}>
                  <Chips options={WHEN_OPTIONS.map((w) => ({ value: w.value as When, label: w.label as string }))} value={when} onChange={setWhen} />
                  {when === 'pick' ? <TextField label="Follow-up date" value={picked} onChangeText={setPicked} placeholder={houseDay(today)} autoCorrect={false} /> : null}
                </View>
              )}
              <Button title="Save" variant="primary" busy={busy} disabled={busy} onPress={save} />
            </Card>
          ) : null}

          <Card>
            <Label>ACTIVITY</Label>
            {act.loading && !act.data ? <Loading what="Loading the activity…" /> : null}
            {act.failure ? <LoadFailed failure={act.failure} onRetry={act.refresh} stale={!!act.data} /> : null}
            {act.data && act.data.activity.length === 0 ? <AppText color="textMuted">Nothing logged yet.</AppText> : null}
            {(act.data?.activity ?? []).slice(0, 30).map((a) => (
              <View key={a.id} style={[styles.event, { borderColor: t.colors.border }]}>
                <AppText>{a.note || a.event_type.replace(/_/g, ' ')}</AppText>
                <AppText variant="caption" color="textSubtle">
                  {[`${houseDay(kuwaitDay(a.created_at))}, ${formatTime(a.created_at)}`, a.actor_name].filter(Boolean).join(' · ')}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  half: { flex: 1 },
  stage: { paddingHorizontal: 12, paddingVertical: 6 },
  event: { borderLeftWidth: 2, paddingLeft: 10, gap: 2 },
});
