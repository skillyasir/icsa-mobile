import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { houseDay } from '@/reception/money';
import { Chips } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { dialable } from '@/teacher/students';
import { useAppTheme } from '@/theme/useAppTheme';

import { type ListAnswer } from './leads';
import { BUCKETS, bucketPath, waUrl, type Bucket } from './more';

// Marketer › Follow-ups (bunch 2 board 1, approved 14 Nov 2026): her leads to
// call, in the AMS's own buckets (overdue, today, this week — prospectFilter's
// fu=), with Call · WhatsApp · Log; and her students' follow-ups (the Follow-up
// Centre the AMS scopes to the students she referred or registered).

const COLOR: Record<Bucket, 'onDangerSoft' | 'onWarningSoft' | 'textSubtle'> = { overdue: 'onDangerSoft', today: 'onWarningSoft', week: 'textSubtle' };

function BucketList({ b, live }: { b: Bucket; live: boolean }) {
  const t = useAppTheme();
  const router = useRouter();
  const data = useAmsGet<ListAnswer>(bucketPath(b), live);
  const rows = data.data?.prospects ?? [];
  const label = BUCKETS.find((x) => x.value === b)?.label ?? '';
  if (data.loading && !data.data) return <Loading what="Loading…" />;
  if (data.failure && !data.data) return <LoadFailed failure={data.failure} onRetry={data.refresh} />;
  return (
    <View style={{ gap: t.space.sm }}>
      <AppText variant="label" color={COLOR[b]}>{`${label} · ${data.data?.total ?? rows.length}`}</AppText>
      {rows.length === 0 ? <AppText color="textSubtle">Nobody.</AppText> : null}
      {rows.map((p) => {
        const phone = dialable(p.phone);
        const wa = waUrl(p.whatsapp || p.phone, p.full_name);
        const due = p.next_followup_date ? p.next_followup_date.slice(0, 10) : null;
        return (
          <Card key={p.id}>
            <View style={styles.between}>
              <AppText variant="bodyStrong" style={styles.grow}>
                {p.full_name ?? 'Lead'}
              </AppText>
              <AppText variant="caption" color={COLOR[b]}>
                {b === 'today' ? 'Today' : due ? `Due ${houseDay(due)}` : ''}
              </AppText>
            </View>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {[p.course_interest_name, p.last_note ? `“${p.last_note}”` : null].filter(Boolean).join(' · ') || 'No note yet'}
            </AppText>
            <View style={[styles.row, { gap: t.space.sm }]}>
              <View style={styles.grow}>
                <Button title="Call" variant="primary" disabled={!phone} onPress={() => phone && Linking.openURL(`tel:${phone}`)} />
              </View>
              <View style={styles.grow}>
                <Button title="WhatsApp" variant="success" disabled={!wa} onPress={() => wa && Linking.openURL(wa)} />
              </View>
              <View style={styles.grow}>
                <Button title="Log" variant="outline" onPress={() => router.push({ pathname: '/lead', params: { id: p.id } })} />
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

export function FollowupsLeadsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const [view, setView] = useState<'leads' | 'students'>('leads');
  const today = kuwaitDay(new Date()) ?? '';

  return (
    <Screen title="Follow-ups" eyebrow={houseDay(today)}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          <Chips
            options={[
              { value: 'leads', label: 'Leads' },
              { value: 'students', label: 'My students' },
            ]}
            value={view}
            onChange={(v) => (v === 'students' ? router.push('/student-followups') : setView(v))}
          />
          <View style={{ gap: t.space.lg }}>
            {BUCKETS.map((b) => (
              <BucketList key={b.value} b={b.value} live={live} />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
