import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { openSettings, readFix } from '@/attendance/location';
import { LOCATION_MESSAGES, formatDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { STAFF_API, WIFI_NOTES, addRouterBody, routerName, type Fix, type OfficeRouter, type Offices, type Wifi } from './rules';
import { readWifi } from './wifi';

// Office Wi-Fi (managers; staff attendance, 11 Nov 2026): each branch's office
// routers, and Add this router — read where the manager stands, so the AMS has
// its evidence (the phone inside that branch's circle). Removing is the AMS's
// timestamp, never a delete (Yasir: removal in the app as well as the web).

type Read = { fix: Fix | null; wifi: Wifi; notes: string[]; settings: boolean };
type Outcome = { tone: 'success' | 'warning' | 'danger'; text: string };

export function OfficeWifiScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const { user } = useSession();
  const live = !!user && !user.preview;
  const offices = useAmsGet<Offices>(STAFF_API.offices.path, live);
  const [read, setRead] = useState<Read | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const branches = offices.data?.branches ?? [];

  const readHere = async () => {
    setOutcome(null);
    setBusy('read');
    const notes: string[] = [];
    let settings = false;
    const got = await readFix();
    if (!got.ok) {
      notes.push(LOCATION_MESSAGES[got.why]);
      settings = got.settings;
    }
    const w = await readWifi();
    if (w.note) notes.push(WIFI_NOTES[w.note]);
    setRead({ fix: got.ok ? got.fix : null, wifi: { bssid: w.bssid, ssid: w.ssid }, notes, settings });
    if (!branchId && user?.branch_id && branches.some((b) => b.id === user.branch_id)) setBranchId(user.branch_id);
    setBusy(null);
  };

  const add = async (bid: string, wifi: Wifi, fix: Fix | null, key: string) => {
    setOutcome(null);
    setBusy(key);
    const r = await ams.request<{ added_how?: string }>('POST', STAFF_API.addRouter.path, addRouterBody(bid, wifi, fix, null));
    if (r.ok) {
      const b = branches.find((x) => x.id === bid);
      setOutcome({ tone: 'success', text: `Router added at ${b?.name ?? 'the branch'}.` });
      setRead(null);
    } else setOutcome({ tone: 'danger', text: r.failure.message });
    await offices.reload();
    setBusy(null);
  };

  const remove = (r: OfficeRouter, branch: string) => {
    Alert.alert('Remove this router?', `${routerName(r)} will no longer count as ${branch}’s office Wi-Fi. Check-ins already made keep their record.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setOutcome(null);
          setBusy(`remove-${r.id}`);
          const res = await ams.request('DELETE', pathFor(STAFF_API.removeRouter.path, { id: r.id }));
          setOutcome(res.ok ? { tone: 'success', text: 'Router removed.' } : { tone: 'danger', text: res.failure.message });
          await offices.reload();
          setBusy(null);
        },
      },
    ]);
  };

  const back = (
    <Pressable accessibilityRole="link" hitSlop={12} style={styles.back} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <AppText variant="bodyStrong" color="link">
        ‹ Me
      </AppText>
    </Pressable>
  );

  return (
    <Screen title="Office Wi-Fi" top={back} refreshing={offices.refreshing} onRefresh={live ? offices.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : offices.loading && !offices.data ? (
        <Loading what="Loading the branches…" />
      ) : offices.failure && !offices.data ? (
        <LoadFailed failure={offices.failure} onRetry={offices.refresh} />
      ) : (
        <>
          {offices.failure ? <LoadFailed failure={offices.failure} onRetry={offices.refresh} stale /> : null}
          {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}

          <Card>
            <AppText variant="headline">Add this router</AppText>
            <AppText color="textMuted">
              1. Stand inside the branch, connected to its Wi-Fi. 2. Tap Read this Wi-Fi. 3. Repeat in each room with its own router — each band has its own address.
            </AppText>
            <Button title="Read this Wi-Fi" variant="outline" busy={busy === 'read'} disabled={busy !== null} onPress={readHere} />
            {read ? (
              <View style={{ gap: t.space.sm }}>
                {read.notes.length ? <Notice tone="warning">{read.notes.join(' ')}</Notice> : null}
                {read.settings ? <Button title="Open Settings" variant="outline" onPress={openSettings} /> : null}
                {read.wifi.bssid ? (
                  <>
                    <AppText variant="bodyStrong">{routerName({ ssid: read.wifi.ssid, bssid: read.wifi.bssid })}</AppText>
                    <AppText variant="label" color="textMuted">
                      BRANCH
                    </AppText>
                    {branches.map((b) => {
                      const on = b.id === branchId;
                      return (
                        <Pressable
                          key={b.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          onPress={() => setBranchId(b.id)}
                          style={styles.choice}
                        >
                          <AppText variant={on ? 'bodyStrong' : 'body'} style={styles.flex}>
                            {b.name}
                          </AppText>
                          <AppText variant="bodyStrong" color="link">
                            {on ? '✓' : ''}
                          </AppText>
                        </Pressable>
                      );
                    })}
                    <Button
                      title="Add router"
                      variant="attention"
                      busy={busy === 'add'}
                      disabled={busy !== null || !branchId}
                      onPress={() => branchId && add(branchId, read.wifi, read.fix, 'add')}
                    />
                  </>
                ) : null}
              </View>
            ) : null}
          </Card>

          {branches.map((b) => (
            <View key={b.id} style={{ gap: t.space.sm }}>
              <AppText variant="label" color="textMuted">
                {b.name.toUpperCase()}
              </AppText>
              <Card>
                {!b.has_location ? (
                  <AppText color="textMuted">This branch has no location on the AMS yet, so the location check cannot pass there.</AppText>
                ) : null}
                {b.routers.length === 0 ? <AppText color="textMuted">No office routers yet.</AppText> : null}
                {b.routers.map((r) => (
                  <View key={r.id} style={styles.item}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{r.label || r.ssid || 'Router'}</AppText>
                      <AppText variant="caption" color="textSubtle">
                        {[r.bssid, r.added_on ? `added ${formatDay(`${r.added_on}T12:00:00+03:00`)}` : null, r.last_seen_at ? `last seen ${formatDay(r.last_seen_at)}` : 'not seen at a check-in yet']
                          .filter(Boolean)
                          .join(' · ')}
                      </AppText>
                    </View>
                    <Button title="Remove" variant="danger" block={false} busy={busy === `remove-${r.id}`} disabled={busy !== null} onPress={() => remove(r, b.name)} />
                  </View>
                ))}
                {b.unknown.length ? (
                  <View style={{ gap: t.space.sm }}>
                    <AppText variant="label" color="textMuted">
                      SEEN AT CHECK-INS HERE, NOT ON FILE
                    </AppText>
                    {b.unknown.map((u) => (
                      <View key={u.bssid} style={styles.item}>
                        <View style={styles.flex}>
                          <AppText variant="bodyStrong">{u.ssid || 'Router'}</AppText>
                          <AppText variant="caption" color="textSubtle">
                            {u.bssid} · {u.times} {u.times === 1 ? 'check-in' : 'check-ins'}
                          </AppText>
                        </View>
                        <Button
                          title="Add"
                          variant="outline"
                          block={false}
                          busy={busy === `seen-${u.bssid}`}
                          disabled={busy !== null}
                          onPress={() => add(b.id, { bssid: u.bssid, ssid: u.ssid }, null, `seen-${u.bssid}`)}
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start' },
  flex: { flex: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', minHeight: minTouch },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
