import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { formatDay, kd, kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { dialable, whatsappUrl } from '@/teacher/students';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  FOLLOWUP_TABS,
  NEXT_CHOICES,
  RECEPTION_API,
  addDaysYmd,
  caseBadge,
  daysBetween,
  logBody,
  minePath,
  outcomesFor,
  type FollowupCase,
  type LogType,
  type MineAnswer,
  type OutcomeChoice,
} from './rules';

// Follow-ups (mockup 12, approved 3 Nov 2026; built 13 Nov 2026): the
// Follow-up Centre's cases this person works — due today, overdue, upcoming —
// with Call, WhatsApp and "How did it go?". The AMS decides who sees which
// case, opens and closes them, and checks every promise; the app logs what
// happened, in the website's own words.

export function FollowupsScreen() {
  const t = useAppTheme();
  const { user } = useSession();
  const live = !user?.preview;
  const params = useLocalSearchParams<{ kind?: string }>();
  // Today's "fees overdue" row opens this tab with ?kind=payment; the tab stays
  // mounted, so a later hand-over is taken during render (no effect).
  const handed = params.kind === 'payment' ? 'payment' : null;
  const [feesOnly, setFeesOnly] = useState(handed === 'payment');
  const [taken, setTaken] = useState(handed);
  if (handed !== taken) {
    setTaken(handed);
    if (handed) setFeesOnly(true);
  }
  const mine = useAmsGet<MineAnswer>(minePath(feesOnly ? 'payment' : null), live);
  const [tab, setTab] = useState<'today' | 'overdue' | 'upcoming'>('today');
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!live) {
    return (
      <Screen title="Follow-ups">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no follow-ups to show.
        </Notice>
      </Screen>
    );
  }

  const counts = mine.data?.counts;
  const cases = (mine.data?.cases ?? []).filter((c) => c.bucket === tab);
  const today = kuwaitDay(new Date()) ?? '';

  return (
    <Screen title="Follow-ups" refreshing={mine.refreshing} onRefresh={mine.refresh}>
      <View style={[styles.tabs, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.lg }]} accessibilityRole="tablist">
        {FOLLOWUP_TABS.map((x) => {
          const on = x.key === tab;
          const n = counts ? counts[x.key] : null;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setTab(x.key)}
              style={[styles.tab, { borderRadius: t.radius.md, backgroundColor: on ? t.colors.surface : t.colors.surfaceMuted }]}
            >
              <AppText variant="bodyStrong" color={x.key === 'overdue' && n ? 'onDangerSoft' : on ? 'text' : 'textMuted'} numberOfLines={1}>
                {n ? `${x.label} ${n}` : x.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: feesOnly }} onPress={() => setFeesOnly((v) => !v)} style={styles.filter}>
        <AppText variant="bodyStrong" color="link">
          {feesOnly ? '✓ Fees overdue only' : 'Show fees overdue only'}
        </AppText>
      </Pressable>

      {mine.loading && !mine.data ? <Loading what="Loading your follow-ups…" /> : null}
      {mine.failure ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} stale={!!mine.data} /> : null}
      {done ? <Notice tone="success">{done}</Notice> : null}
      {mine.data && cases.length === 0 ? (
        <Card>
          <AppText color="textMuted">{tab === 'overdue' ? 'Nothing overdue.' : tab === 'today' ? 'Nothing due today.' : 'Nothing coming up.'}</AppText>
        </Card>
      ) : null}
      {cases.map((c) => (
        <CaseCard
          key={c.id}
          c={c}
          today={today}
          open={open === c.id}
          onOpen={() => setOpen(open === c.id ? null : c.id)}
          onLogged={async (text) => {
            setOpen(null);
            setDone(text);
            await mine.reload();
          }}
        />
      ))}
    </Screen>
  );
}

function CaseCard({ c, today, open, onOpen, onLogged }: { c: FollowupCase; today: string; open: boolean; onOpen: () => void; onLogged: (text: string) => void }) {
  const t = useAppTheme();
  const badge = caseBadge(c);
  const tel = dialable(c.student_phone);
  const wa = whatsappUrl(c.student_phone);
  const [type, setType] = useState<LogType>('call');
  const [outcome, setOutcome] = useState<OutcomeChoice | null>(null);
  const [note, setNote] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [promise, setPromise] = useState<string | null>(null);
  const [promiseAmount, setPromiseAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const away = daysBetween(c.last_present, today);
  const facts =
    c.kind === 'payment'
      ? `KD ${kd(c.amount_due)} overdue${c.due_since ? ` since ${formatDay(c.due_since)}` : ''}`
      : c.last_present
        ? `No attendance for ${away} day${away === 1 ? '' : 's'}`
        : 'Not attended yet';
  const lastCall = c.last_log_at ? `last contact ${formatDay(c.last_log_at)}${c.last_outcome ? ` — ${labelOf(c)}` : ''}` : 'not contacted yet';

  const save = async () => {
    const b = logBody({ type, outcome, note, nextDate: next, promiseDate: promise, promiseAmount, today });
    if (!b.ok) return setError(b.message);
    setError(null);
    setBusy(true);
    const r = await ams.request('POST', pathFor(RECEPTION_API.logFollowup.path, { id: c.id }), b.body);
    setBusy(false);
    if (!r.ok) return setError(r.failure.message);
    onLogged(`Logged for ${c.student_name ?? 'the student'}.`);
  };

  return (
    <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: open ? t.colors.primary : t.colors.border, borderRadius: t.radius.xl, gap: t.space.sm }]}>
      <View style={styles.head}>
        <AppText variant="headline" style={styles.flex} numberOfLines={1}>
          {c.student_name ?? 'Student'}
        </AppText>
        <Pill text={badge.text} tone={badge.tone} />
      </View>
      <AppText variant="caption" color="textSubtle" numberOfLines={1}>
        {[c.course_name, c.student_code ?? c.enrollment_no].filter(Boolean).join(' · ')}
      </AppText>
      <AppText>
        {facts} · {lastCall}
      </AppText>
      <View style={[styles.buttons, { gap: t.space.sm }]}>
        {tel ? (
          <View style={styles.flex}>
            <Button
              title="Call"
              variant="outline"
              onPress={() => {
                setType('call');
                Linking.openURL(`tel:${tel}`);
              }}
            />
          </View>
        ) : null}
        {wa ? (
          <View style={styles.flex}>
            <Button
              title="WhatsApp"
              variant="outline"
              onPress={() => {
                setType('whatsapp');
                Linking.openURL(wa);
              }}
            />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Button title={open ? 'Close' : 'Log'} variant={open ? 'outline' : 'primary'} onPress={onOpen} />
        </View>
      </View>

      {open ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="bodyStrong">How did it go?</AppText>
          <View style={[styles.chips, { gap: t.space.sm }]}>
            {outcomesFor(c.kind).map((o) => (
              <Chip key={o.key} label={o.label} on={outcome?.key === o.key} onPress={() => setOutcome(outcome?.key === o.key ? null : o)} />
            ))}
          </View>
          {outcome?.promise ? (
            <>
              <AppText variant="bodyStrong">{c.kind === 'payment' ? 'They will pay by' : 'They will be back by'}</AppText>
              <View style={[styles.chips, { gap: t.space.sm }]}>
                {NEXT_CHOICES.map((n) => {
                  const d = addDaysYmd(today, n.days);
                  return <Chip key={n.label} label={`${n.label} · ${formatDay(d)}`} on={promise === d} onPress={() => setPromise(d)} />;
                })}
              </View>
              {c.kind === 'payment' ? (
                <TextField label="Amount promised (KD, optional)" value={promiseAmount} onChangeText={setPromiseAmount} keyboardType="decimal-pad" placeholder={c.amount_due ? kd(c.amount_due) : '45.000'} />
              ) : null}
            </>
          ) : null}
          <TextField label="Note" value={note} onChangeText={setNote} placeholder="Will pay on Saturday at reception" />
          <AppText variant="bodyStrong">Next follow-up</AppText>
          <View style={[styles.chips, { gap: t.space.sm }]}>
            {NEXT_CHOICES.map((n) => {
              const d = addDaysYmd(today, n.days);
              return <Chip key={n.label} label={`${n.label} · ${formatDay(d)}`} on={next === d} onPress={() => setNext(next === d ? null : d)} />;
            })}
          </View>
          <AppText variant="caption" color="textSubtle">
            Logged as a {type === 'whatsapp' ? 'WhatsApp message' : 'call'}. No date picked: the AMS sets the next one.
          </AppText>
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Button title="Save" busy={busy} disabled={busy} onPress={save} />
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[styles.chip, { borderRadius: t.radius.pill, borderColor: on ? t.colors.primary : t.colors.borderStrong, backgroundColor: on ? t.colors.primary : t.colors.surface }]}
    >
      <AppText variant="bodyStrong" style={{ color: on ? t.colors.onPrimary : t.colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The last outcome in words: this case's own list first, the raw key otherwise. */
function labelOf(c: FollowupCase): string {
  return outcomesFor(c.kind).find((o) => o.key === c.last_outcome)?.label ?? String(c.last_outcome ?? '').replace(/_/g, ' ');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: { flexDirection: 'row', padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: minTouch },
  filter: { alignSelf: 'flex-start', minHeight: minTouch, justifyContent: 'center' },
  card: { borderWidth: 1.5, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttons: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1.5, paddingHorizontal: 14, minHeight: minTouch - 4, justifyContent: 'center' },
});
