import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams, DEVICE } from '@/api/client';
import { pathFor } from '@/api/paths';
import { openSettings, readFix } from '@/attendance/location';
import { LOCATION_MESSAGES, formatClock, formatWeekdayDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import { applyReminders } from './reminders';
import {
  KIND_LABEL,
  KIND_NOUN,
  NOT_WORKING,
  STAFF_API,
  WIFI_NOTES,
  dayLine,
  hours,
  lateMinutes,
  lateWord,
  lunchNow,
  pendingTaps,
  proofBody,
  reasonLine,
  reminderPlan,
  tapBody,
  tapButton,
  timeline,
  type DayTap,
  type Fix,
  type MyDay,
  type RecheckAnswer,
  type TapAnswer,
  type TapKind,
  type Wifi,
} from './rules';
import { readWifi } from './wifi';

// My day (staff attendance, board 3, approved 11 Nov 2026): the person's own
// working day — hours, the next of the four taps, lunch, anything kept for
// review, and the day's timeline. Every figure is the AMS's
// (GET /staff-attendance/me/today); the AMS decides every tap.
//
// Yasir, 11 Nov 2026: the location and office Wi-Fi are read ONLY when the
// person taps — before a tap the screen says what will be checked, after it
// what the AMS found.

type Outcome = { tone: 'success' | 'info' | 'warning' | 'danger'; title?: string; text: string };

/** Both proofs, read at a tap. Never refuses on the phone: the AMS keeps a doubtful tap for review. */
async function readProofs(): Promise<{ fix: Fix | null; wifi: Wifi; notes: string[]; settings: boolean }> {
  const notes: string[] = [];
  let settings = false;
  const got = await readFix();
  let fix: Fix | null = null;
  if (got.ok) fix = got.fix;
  else {
    notes.push(LOCATION_MESSAGES[got.why]);
    settings = got.settings;
  }
  const w = await readWifi();
  if (w.note) notes.push(WIFI_NOTES[w.note]);
  return { fix, wifi: { bssid: w.bssid, ssid: w.ssid }, notes, settings };
}

/** What the AMS recorded. A tap kept for review says only that here — its own card below explains it. */
function tapOutcome(a: TapAnswer, kind: TapKind): Outcome {
  const t = a.tap;
  const text = `${KIND_LABEL[kind]} recorded at ${formatClock(t.time)}${kind === 'in' ? ` · ${lateWord(t.late_min)}` : ''}.`;
  return t.review === 'pending' ? { tone: 'info', text } : { tone: 'success', text };
}

export function MyDayScreen() {
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const my = useAmsGet<MyDay>(STAFF_API.today.path, live);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notes, setNotes] = useState<{ lines: string[]; settings: boolean } | null>(null);

  const day = my.data;

  // The reminders follow the day: re-planned on every load (and so after every tap).
  useEffect(() => {
    if (day) applyReminders(reminderPlan(day));
  }, [day]);

  const send = async (kind: TapKind) => {
    if (!day?.day) return;
    setOutcome(null);
    setNotes(null);
    setBusy(kind);
    let fix: Fix | null = null;
    let wifi: Wifi | null = null;
    if (day.day.place === 'office') {
      const p = await readProofs();
      fix = p.fix;
      wifi = p.wifi;
      if (p.notes.length) setNotes({ lines: p.notes, settings: p.settings });
    }
    const r = await ams.request<TapAnswer>('POST', STAFF_API.tap.path, tapBody(kind, fix, wifi, DEVICE.platform));
    if (r.ok) setOutcome(tapOutcome(r.value, kind));
    else setOutcome({ tone: 'danger', text: r.failure.message });
    await my.reload();
    setBusy(null);
  };

  const tap = (kind: TapKind) => {
    if (kind !== 'out') {
      send(kind);
      return;
    }
    // Checking out ends the day's record — asked once, like the student's check-out.
    Alert.alert('Check out?', 'This records the end of your working day.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Check out', onPress: () => send(kind) },
    ]);
  };

  const recheck = async (x: DayTap) => {
    setOutcome(null);
    setNotes(null);
    setBusy(`recheck-${x.id}`);
    const p = await readProofs();
    if (p.notes.length) setNotes({ lines: p.notes, settings: p.settings });
    const r = await ams.request<RecheckAnswer>('POST', pathFor(STAFF_API.recheck.path, { id: x.id }), proofBody(p.fix, p.wifi));
    if (!r.ok) setOutcome({ tone: 'danger', text: r.failure.message });
    else if (r.value.cleared) setOutcome({ tone: 'success', text: 'Both office checks passed — the review cleared itself.' });
    else setOutcome({ tone: 'warning', title: 'Still waiting for review', text: r.value.reason ?? 'A manager will look at it.' });
    await my.reload();
    setBusy(null);
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Back
      </AppText>
    </Pressable>
  );

  const subtitle = day ? [formatWeekdayDay(`${day.date}T12:00:00+03:00`), day.branch?.name].filter(Boolean).join(' · ') : '';

  return (
    <Screen title="My day" eyebrow={subtitle || undefined} top={back} refreshing={my.refreshing} onRefresh={live ? my.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there is no working day to show.
        </Notice>
      ) : my.loading && !day ? (
        <Loading what="Loading your day…" />
      ) : my.failure && !day ? (
        <LoadFailed failure={my.failure} onRetry={my.refresh} />
      ) : !day ? null : !day.working || !day.day ? (
        <Card>
          <AppText variant="headline">{day.reason === 'day_off' ? 'Day off' : 'No working week yet'}</AppText>
          <AppText color="textMuted">{NOT_WORKING[day.reason ?? 'no_week']}</AppText>
        </Card>
      ) : (
        <DayBody
          day={day}
          busy={busy}
          outcome={outcome}
          notes={notes}
          onTap={tap}
          onRecheck={recheck}
          stale={my.failure}
          retry={my.refresh}
        />
      )}
    </Screen>
  );
}

function DayBody({
  day,
  busy,
  outcome,
  notes,
  onTap,
  onRecheck,
  stale,
  retry,
}: {
  day: MyDay;
  busy: string | null;
  outcome: Outcome | null;
  notes: { lines: string[]; settings: boolean } | null;
  onTap: (k: TapKind) => void;
  onRecheck: (x: DayTap) => void;
  stale: ReturnType<typeof useAmsGet>['failure'];
  retry: () => void;
}) {
  const t = useAppTheme();
  const d = day.day!;
  const office = d.place === 'office';
  const next = day.next;
  const first = next[0] ?? null;
  const lunch = lunchNow(day);
  const pending = pendingTaps(day);
  const rows = timeline(day);
  const lateNow = first === 'in' ? lateMinutes(day.now, d.start_time, day.rules.late_grace_min) : 0;

  return (
    <>
      {stale ? <LoadFailed failure={stale} onRetry={retry} stale /> : null}

      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="title">{hours(d.start_time, d.end_time)}</AppText>
            <AppText color="textMuted">{dayLine(d)}</AppText>
          </View>
          <Pill text={office ? 'On-site' : 'Online'} tone={office ? 'info' : 'muted'} />
        </View>
      </Card>

      {outcome ? (
        <Notice tone={outcome.tone} title={outcome.title}>
          {outcome.text}
        </Notice>
      ) : null}
      {notes ? (
        <View style={{ gap: t.space.sm }}>
          <Notice tone="warning">{notes.lines.join(' ')}</Notice>
          {notes.settings ? <Button title="Open Settings" variant="outline" onPress={openSettings} /> : null}
        </View>
      ) : null}

      {pending.map((x) => (
        <Card key={x.id}>
          <AppText variant="headline">{KIND_LABEL[x.kind]} kept for review</AppText>
          <AppText>
            Location {x.location_ok ? '✓' : '✗'} · Office Wi-Fi {x.wifi_ok ? '✓' : '✗'}
          </AppText>
          {reasonLine(x.review_reason) ? <AppText color="textMuted">{reasonLine(x.review_reason)}</AppText> : null}
          <Notice tone="warning">
            {`Your ${KIND_NOUN[x.kind]} is saved. ${x.location_ok === false && x.wifi_ok === false ? 'Neither office check passed' : 'Only one office check passed'}, so a manager will look at it.`}
          </Notice>
          <Button title="Check the Wi-Fi again" variant="outline" busy={busy === `recheck-${x.id}`} disabled={busy !== null} onPress={() => onRecheck(x)} />
          <AppText variant="caption" color="textSubtle">
            Join the office Wi-Fi, then tap. If both checks pass now, the review clears by itself.
          </AppText>
        </Card>
      ))}

      {lunch ? (
        <Card>
          <AppText variant="headline">On lunch</AppText>
          <AppText color="textMuted">
            Since {lunch.since} · back by {lunch.backBy}
          </AppText>
          <View style={[styles.track, { backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.pill }]}>
            <View
              style={{
                width: `${Math.min(100, Math.round((lunch.usedMin / Math.max(1, lunch.breakMin)) * 100))}%`,
                height: '100%',
                backgroundColor: lunch.usedMin > lunch.overAfterMin ? t.colors.onDangerSoft : t.colors.primary,
                borderRadius: t.radius.pill,
              }}
            />
          </View>
          <AppText variant="caption" color="textSubtle">
            {lunch.usedMin} of {lunch.breakMin} min. More than {lunch.overAfterMin} min counts as over-break on your monthly report.
          </AppText>
        </Card>
      ) : null}

      {first ? (
        <Card>
          {office ? (
            <View style={{ gap: t.space.xs }}>
              <AppText variant="label" color="textMuted">
                EACH TAP CHECKS
              </AppText>
              <AppText>Location — inside {day.branch?.name ?? 'your branch'}</AppText>
              <AppText>Office Wi-Fi — the branch’s router</AppText>
              <AppText variant="caption" color="textSubtle">
                Read only when you tap — never in the background.
              </AppText>
            </View>
          ) : (
            <AppText color="textMuted">An online day needs no office check.</AppText>
          )}
          <Button title={tapButton(first, d.place)} variant="attention" busy={busy === first} disabled={busy !== null} onPress={() => onTap(first)} />
          {first === 'in' ? (
            <AppText variant="caption" color="textSubtle" style={styles.centred}>
              {formatClock(day.now)} · {lateWord(lateNow)}
            </AppText>
          ) : null}
          {next.slice(1).map((k) => (
            <Button key={k} title={tapButton(k, d.place)} variant="outline" busy={busy === k} disabled={busy !== null} onPress={() => onTap(k)} />
          ))}
        </Card>
      ) : (
        <Card>
          <AppText variant="headline">Day complete</AppText>
          <AppText color="textMuted">You have checked out for today.</AppText>
        </Card>
      )}

      <View style={{ gap: t.space.sm }}>
        <AppText variant="label" color="textMuted">
          TODAY
        </AppText>
        <Card>
          {rows.map((r) => (
            <View key={r.kind} style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" color={r.done ? 'text' : 'textMuted'}>
                  {r.label}
                </AppText>
                <AppText variant="caption" color="textSubtle">
                  {r.line}
                </AppText>
              </View>
              <AppText variant="bodyStrong" color={r.done ? 'text' : 'textSubtle'}>
                {r.time}
              </AppText>
            </View>
          ))}
        </Card>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  track: { height: 8, overflow: 'hidden' },
  centred: { textAlign: 'center' },
});
