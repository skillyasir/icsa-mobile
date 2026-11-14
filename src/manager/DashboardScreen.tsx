import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { Chips, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import { BranchPick } from './BranchPick';
import {
  ALL,
  BRANCHES_ACTIVE,
  PERIOD_CHIPS,
  branchBars,
  dashboardPath,
  dashboardTiles,
  dayChart,
  dayHeading,
  showBranchBars,
  type Branch,
  type ManagerDashboard,
  type Period,
} from './reports';

// Manager › Dashboard (Managers bunch 2 mockup, approved 14 Nov 2026): the
// AMS's own figures for the period and branch chosen — collected, enrolments,
// check-ins today, what is owed — then collected by branch and the AMS's
// last-30-days chart. Read-only; the full dashboard stays on the website.

export function DashboardScreen() {
  const t = useAppTheme();
  const { user } = useSession();
  const live = !user?.preview;
  const today = kuwaitDay(new Date()) ?? '';
  const [period, setPeriod] = useState<Period>('month');
  const [branch, setBranch] = useState<string>(ALL);
  const branches = useAmsGet<{ branches: Branch[] }>(BRANCHES_ACTIVE, live);
  const path = dashboardPath(period, branch);
  const dash = useAmsGet<ManagerDashboard>(path, live);

  // Figures only for what is on screen: after a switch, the last answer was for another period or branch.
  const d = dash.dataPath === path ? dash.data : null;
  const tiles = dashboardTiles(d, period);
  const bars = showBranchBars(d) ? branchBars(d?.kpis.collection_period) : [];
  const chart = d ? dayChart(d.charts?.revenue_30day, today) : null;

  return (
    <Screen title="Dashboard" eyebrow={today ? dayHeading(today) : undefined} refreshing={dash.refreshing} onRefresh={live ? dash.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          <BranchPick branches={branches.data?.branches} value={branch} onChange={setBranch} />
          <Chips options={PERIOD_CHIPS} value={period} onChange={setPeriod} />

          {dash.failure ? <LoadFailed failure={dash.failure} onRetry={dash.refresh} stale={!!d} /> : null}
          {!d && !dash.failure ? <Loading what="Loading the figures…" /> : null}

          {tiles.length ? (
            <View style={[styles.grid, { gap: t.space.sm }]}>
              {tiles.map((f) => (
                <View key={f.label} style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
                  <AppText variant="caption" color="textSubtle">
                    {f.label}
                  </AppText>
                  <AppText variant="title" color={f.tone === 'danger' ? 'onDangerSoft' : 'text'} numberOfLines={1} adjustsFontSizeToFit>
                    {f.value}
                  </AppText>
                  <AppText variant="caption" color="textSubtle">
                    {f.sub}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {bars.length ? (
            <Card>
              <Label>COLLECTED BY BRANCH</Label>
              {bars.map((b) => (
                <View key={b.id} style={{ gap: t.space.xs }} accessible accessibilityLabel={`${b.name}, ${b.amount} KD`}>
                  <View style={styles.between}>
                    <AppText variant="bodyStrong" style={styles.grow}>
                      {b.name}
                    </AppText>
                    <AppText variant="bodyStrong">{b.amount}</AppText>
                  </View>
                  <View style={[styles.track, { backgroundColor: t.colors.infoSoft, borderRadius: t.radius.pill }]}>
                    <View style={[styles.fill, { width: `${Math.round(b.share * 100)}%`, backgroundColor: t.colors.primary, borderRadius: t.radius.pill }]} />
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          {chart ? (
            <Card>
              <Label>LAST 30 DAYS</Label>
              <View style={[styles.chart, { gap: 2 }]} accessible accessibilityRole="image" accessibilityLabel={chart.label}>
                {chart.bars.map((b, i) => (
                  <View
                    key={`${i}-${b.day}`}
                    style={[styles.bar, { height: `${Math.max(2, Math.round(b.share * 100))}%`, backgroundColor: b.last ? t.colors.attention : t.colors.primary }]}
                  />
                ))}
              </View>
              <View style={styles.between}>
                <AppText variant="caption" color="textSubtle">
                  {chart.from}
                </AppText>
                <AppText variant="caption" color="textSubtle">
                  {chart.to}
                </AppText>
              </View>
              {chart.best ? (
                <AppText variant="caption" color="textSubtle">
                  {`Best day: ${chart.best.day} · ${chart.best.amount} KD`}
                </AppText>
              ) : null}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, padding: 12, gap: 2 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  track: { height: 8, overflow: 'hidden' },
  fill: { height: '100%' },
  chart: { height: 64, flexDirection: 'row', alignItems: 'flex-end' },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
