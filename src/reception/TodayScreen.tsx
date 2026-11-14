import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatWeekdayDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { useSession } from '@/session/SessionContext';
import { StaffDayCard } from '@/staff/StaffDayCard';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { DASHBOARD_TODAY, RECEPTION_API, minePath, needsYou, todayFigures, type ApprovalsSummary, type Dashboard, type MineAnswer, type NeedsRow } from './rules';

// Reception's Today (mockup 08, approved 3 Nov 2026; built 13 Nov 2026): find
// a student, the four things reception does, today's figures and what is
// waiting. Every number is the AMS's, scoped by it to the person's branch.

type Action = { label: string; tone: 'primary' | 'success' | 'plain'; go: () => void };

export function TodayScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const dash = useAmsGet<Dashboard>(DASHBOARD_TODAY, live);
  const approvals = useAmsGet<ApprovalsSummary>(RECEPTION_API.approvals.path, live);
  const mine = useAmsGet<MineAnswer>(minePath(null, 5), live);
  const [text, setText] = useState('');
  const [openedAt] = useState(() => new Date().toISOString());

  if (!live) {
    return (
      <Screen title="Today" eyebrow="Reception">
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account, so there are no figures to show.
        </Notice>
      </Screen>
    );
  }

  const refresh = () => {
    dash.refresh();
    approvals.refresh();
    mine.refresh();
  };
  const find = () => {
    const q = text.trim();
    if (q.length >= 2) router.push({ pathname: '/reception/students', params: { q } });
  };
  const figures = todayFigures(dash.data);
  const needs = needsYou(approvals.data, mine.data?.counts ?? null);
  const branch = dash.data?.scope.branch_name ?? user?.branch_name ?? null;

  const actions: Action[] = [
    { label: 'Register student', tone: 'primary', go: () => router.push('/register') },
    { label: 'Take payment', tone: 'success', go: () => router.push('/take-payment') },
    { label: 'Enrol in a course', tone: 'plain', go: () => router.push('/enrol') },
    { label: 'Log a follow-up', tone: 'plain', go: () => router.push('/reception/followups') },
  ];
  const openNeed = (r: NeedsRow) => {
    if (r.key === 'proofs') router.push('/payment-proofs');
    else router.push({ pathname: '/reception/followups', params: r.key === 'fees' ? { kind: 'payment' } : {} });
  };

  return (
    <Screen
      title="Today"
      eyebrow={[formatWeekdayDay(openedAt), branch].filter(Boolean).join(' · ')}
      refreshing={dash.refreshing || approvals.refreshing || mine.refreshing}
      onRefresh={refresh}
    >
      <TextField
        label="Find a student"
        value={text}
        onChangeText={setText}
        onSubmitEditing={find}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="Name, phone, STU code or Civil ID"
      />

      <View style={[styles.grid, { gap: t.space.md }]}>
        {actions.map((a) => {
          const bg = a.tone === 'primary' ? t.colors.primary : a.tone === 'success' ? t.colors.success : t.colors.surface;
          const fg = a.tone === 'plain' ? 'text' : 'onPrimary';
          return (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={a.go}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: bg, borderColor: a.tone === 'plain' ? t.colors.border : bg, borderRadius: t.radius.xl, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <AppText variant="headline" color={fg}>
                {a.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <StaffDayCard />

      {dash.loading && !dash.data ? <Loading what="Loading today’s figures…" /> : null}
      {dash.failure ? <LoadFailed failure={dash.failure} onRetry={dash.refresh} stale={!!dash.data} /> : null}
      {figures.length ? (
        <View style={[styles.row, { gap: t.space.sm }]}>
          {figures.map((f) => (
            <View key={f.label} style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
              <AppText variant="caption" color="textSubtle">
                {f.label}
              </AppText>
              <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
                {f.value}
              </AppText>
              <AppText variant="caption" color="textSubtle">
                {f.sub}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: t.space.sm }}>
        <AppText variant="headline">Needs you</AppText>
        {approvals.failure ? <LoadFailed failure={approvals.failure} onRetry={approvals.refresh} stale={!!approvals.data} /> : null}
        {mine.failure ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} stale={!!mine.data} /> : null}
        {(approvals.data || mine.data) && needs.length === 0 ? (
          <Card>
            <AppText color="textMuted">Nothing is waiting for reception.</AppText>
          </Card>
        ) : null}
        {needs.length ? (
          <Card>
            {needs.map((r, i) => (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                onPress={() => openNeed(r)}
                style={[styles.need, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border }]}
              >
                <Pill text={String(r.count)} tone={r.tone} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {r.label}
                </AppText>
                <AppText variant="bodyStrong" color="textSubtle">
                  ›
                </AppText>
              </Pressable>
            ))}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  action: { flexBasis: '47%', flexGrow: 1, minHeight: 88, padding: 16, borderWidth: 1, justifyContent: 'flex-end' },
  row: { flexDirection: 'row' },
  tile: { flex: 1, borderWidth: 1, padding: 12, gap: 2 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: minTouch, paddingVertical: 8 },
});
