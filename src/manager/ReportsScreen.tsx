import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { kuwaitDay } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { kdAmount } from '@/reception/rules';
import { Chips, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { STUDENT_PROFILE } from '@/teacher/students';
import { useAppTheme } from '@/theme/useAppTheme';

import { BranchPick } from './BranchPick';
import {
  ALL,
  BRANCHES_ACTIVE,
  SORT_CHIPS,
  branchLabel,
  canGoNext,
  collectedLine,
  daysLateWord,
  financialPath,
  instalmentsWord,
  lateTone,
  methodRows,
  monthOf,
  monthRange,
  monthRows,
  overdueLine,
  overduePath,
  shiftMonth,
  sortOverdue,
  type Branch,
  type Financial,
  type Month,
  type OverdueAnswer,
  type Row,
  type Sort,
} from './reports';

// Manager › Reports (Managers bunch 2 mockups, approved 14 Nov 2026; Yasir's
// ruling: Collections and Fees overdue). Read-only, the AMS's own figures;
// every other report, and the report builder, stay on the website.

type Tab = 'collections' | 'overdue';
const TABS: { value: Tab; label: string }[] = [
  { value: 'collections', label: 'Collections' },
  { value: 'overdue', label: 'Fees overdue' },
];
const PAGE = 50;

export function ReportsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const today = kuwaitDay(new Date()) ?? '';
  const [tab, setTab] = useState<Tab>('collections');
  const [branch, setBranch] = useState<string>(ALL);
  const [month, setMonth] = useState<Month>(() => monthOf(today));
  const [sort, setSort] = useState<Sort>('late');
  const [shown, setShown] = useState(PAGE);

  const branches = useAmsGet<{ branches: Branch[] }>(BRANCHES_ACTIVE, live);
  const range = monthRange(month, today);
  const finPath = financialPath(range, branch);
  const overPath = overduePath(branch);
  const fin = useAmsGet<Financial>(finPath, live && tab === 'collections');
  const over = useAmsGet<OverdueAnswer>(overPath, live && tab === 'overdue');
  // Figures only for what is on screen: after a switch, the last answer was for another month or branch.
  const f = fin.dataPath === finPath ? fin.data : null;
  const o = over.dataPath === overPath ? over.data : null;
  const now = tab === 'collections' ? fin : over;

  const pickBranch = (v: string) => {
    setBranch(v);
    setShown(PAGE);
  };
  const pickSort = (v: Sort) => {
    setSort(v);
    setShown(PAGE);
  };

  const rows = (title: string, list: Row[], empty: string) => (
    <Card>
      <Label>{title}</Label>
      {list.length === 0 ? <AppText color="textMuted">{empty}</AppText> : null}
      {list.map((r) => (
        <View key={r.key} style={styles.between}>
          <AppText variant="bodyStrong" style={styles.grow}>
            {r.label}
          </AppText>
          <AppText variant="bodyStrong">
            {r.amount}
            {r.count ? <AppText variant="caption" color="textSubtle">{` · ${r.count}`}</AppText> : null}
          </AppText>
        </View>
      ))}
    </Card>
  );

  const arrow = (label: string, glyph: string, onPress: () => void, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, { borderColor: t.colors.borderStrong, backgroundColor: t.colors.surface, borderRadius: t.radius.md, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }]}
    >
      <AppText variant="headline">{glyph}</AppText>
    </Pressable>
  );

  const items = o ? sortOverdue(o.overdue, sort) : [];

  return (
    <Screen title="Reports" eyebrow={branchLabel(branches.data?.branches, branch)} refreshing={now.refreshing} onRefresh={live ? now.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          <Chips options={TABS} value={tab} onChange={setTab} />
          <BranchPick branches={branches.data?.branches} value={branch} onChange={pickBranch} />

          {now.failure ? <LoadFailed failure={now.failure} onRetry={now.refresh} stale={!!(tab === 'collections' ? f : o)} /> : null}

          {tab === 'collections' ? (
            <>
              <View style={styles.between}>
                {arrow('Previous month', '‹', () => setMonth((m) => shiftMonth(m, -1)), false)}
                <View style={styles.middle}>
                  <AppText variant="headline">{range.title}</AppText>
                  <AppText variant="caption" color="textSubtle">
                    {range.sub}
                  </AppText>
                </View>
                {arrow('Next month', '›', () => setMonth((m) => shiftMonth(m, 1)), !canGoNext(month, today))}
              </View>

              {!f && !fin.failure ? <Loading what="Loading collections…" /> : null}
              {f ? (
                <>
                  <View style={[styles.hero, { backgroundColor: t.colors.hero, borderRadius: t.radius.xl }]}>
                    <AppText variant="label" color="onHeroMuted">
                      COLLECTED
                    </AppText>
                    <AppText variant="largeTitle" color="onHero" numberOfLines={1} adjustsFontSizeToFit>
                      {`KD ${kdAmount(f.summary.total_collected)}`}
                    </AppText>
                    <AppText variant="bodyStrong" color="onHeroMuted">
                      {collectedLine(f.summary)}
                    </AppText>
                  </View>

                  <View style={[styles.pair, { gap: t.space.sm }]}>
                    <View style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
                      <AppText variant="caption" color="textSubtle">
                        Still to come
                      </AppText>
                      <AppText variant="title" numberOfLines={1} adjustsFontSizeToFit>
                        {kdAmount(f.summary.total_pending)}
                      </AppText>
                      <AppText variant="caption" color="textSubtle">
                        KD due, not late yet
                      </AppText>
                    </View>
                    <View style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
                      <AppText variant="caption" color="textSubtle">
                        Overdue
                      </AppText>
                      <AppText variant="title" color="onDangerSoft" numberOfLines={1} adjustsFontSizeToFit>
                        {kdAmount(f.summary.total_overdue)}
                      </AppText>
                      <AppText variant="caption" color="textSubtle">
                        KD late now
                      </AppText>
                    </View>
                  </View>

                  {rows('BY METHOD', methodRows(f), 'No payments in this month.')}
                  {rows('MONTH BY MONTH', monthRows(f, today), 'No payments in the last twelve months.')}
                </>
              ) : null}
            </>
          ) : (
            <>
              {!o && !over.failure ? <Loading what="Loading fees overdue…" /> : null}
              {o ? (
                <>
                  <View style={[styles.hero, styles.between, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.xl }]}>
                    <View style={styles.grow}>
                      <AppText variant="label" color="onDangerSoft">
                        OVERDUE
                      </AppText>
                      <AppText variant="title" color="onDangerSoft" numberOfLines={1} adjustsFontSizeToFit>
                        {`KD ${kdAmount(o.totals.overdue_amount)}`}
                      </AppText>
                    </View>
                    <View style={styles.right}>
                      <AppText variant="title" color="onDangerSoft">
                        {String(o.totals.overdue_count)}
                      </AppText>
                      <AppText variant="caption" color="onDangerSoft">
                        {instalmentsWord(o.totals.overdue_count)}
                      </AppText>
                    </View>
                  </View>

                  {items.length === 0 ? (
                    <Card>
                      <AppText color="textMuted">No fees are overdue.</AppText>
                    </Card>
                  ) : (
                    <>
                      <Chips options={SORT_CHIPS} value={sort} onChange={pickSort} />
                      <View style={[styles.list, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.xl }]}>
                        {items.slice(0, shown).map((i, n) => {
                          const tone = lateTone(i.days_late) === 'danger' ? 'onDangerSoft' : 'onWarningSoft';
                          return (
                            <Pressable
                              key={i.id}
                              accessibilityRole="button"
                              accessibilityHint="Opens the student"
                              onPress={() => router.push({ pathname: STUDENT_PROFILE.manager, params: { id: i.student_id } })}
                              style={({ pressed }) => [styles.item, { borderTopColor: t.colors.border, borderTopWidth: n === 0 ? 0 : 1, opacity: pressed ? 0.7 : 1 }]}
                            >
                              <View style={styles.grow}>
                                <AppText variant="headline">{i.student_name ?? 'Student'}</AppText>
                                <AppText variant="caption" color="textMuted">
                                  {overdueLine(i, branch === ALL)}
                                </AppText>
                              </View>
                              <View style={styles.right}>
                                <AppText variant="headline">{kdAmount(i.balance_due)}</AppText>
                                <AppText variant="caption" color={tone}>
                                  {daysLateWord(i.days_late)}
                                </AppText>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                      {items.length > shown ? <Button title={`Show more · ${items.length - shown} left`} variant="outline" onPress={() => setShown((s) => s + PAGE)} /> : null}
                      <AppText variant="caption" color="textSubtle">
                        Tap a student to open their fees, call or WhatsApp.
                      </AppText>
                    </>
                  )}
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  middle: { flex: 1, alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  arrow: { width: 44, height: 44, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hero: { padding: 14, gap: 4 },
  pair: { flexDirection: 'row' },
  tile: { flex: 1, borderWidth: 1, padding: 12, gap: 2 },
  list: { borderWidth: 1, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
});
