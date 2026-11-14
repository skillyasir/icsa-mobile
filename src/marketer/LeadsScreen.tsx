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
import { TextField } from '@/components/TextField';
import { houseDay } from '@/reception/money';
import { Chips } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { searchParam } from '@/teacher/students';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { headerFigures, leadLine, listPath, stageChips, type ListAnswer, type StageFilter, type Tone } from './leads';

// My leads (mockup 13, approved 3 Nov 2026; built 14 Nov 2026). The AMS
// scopes the list (a marketer sees her own leads), counts the stages and
// works out each lead's expiry; the phone draws them.

export function LeadsScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const [stage, setStage] = useState<StageFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = searchParam(q);
  const data = useAmsGet<ListAnswer>(listPath(stage, search, page), live);
  const rows = data.data?.prospects ?? [];
  const today = kuwaitDay(new Date()) ?? '';
  const toneColor: Record<Tone, 'link' | 'success' | 'onWarningSoft' | 'onDangerSoft' | 'textSubtle'> = {
    info: 'link',
    success: 'success',
    warning: 'onWarningSoft',
    danger: 'onDangerSoft',
    muted: 'textSubtle',
  };

  const choose = (s: StageFilter) => {
    setStage(s);
    setPage(1);
  };

  return (
    <Screen title="My leads" refreshing={data.refreshing} onRefresh={live ? data.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          {data.data ? (
            <View style={[styles.figures, { gap: t.space.sm }]}>
              {headerFigures(data.data).map((f) => (
                <View key={f.label} style={[styles.figure, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg }]}>
                  <AppText variant="title">{String(f.value)}</AppText>
                  <AppText variant="caption" color="textSubtle">
                    {f.label}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          <TextField label="Search my leads" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} placeholder="Name, phone or CRS number" autoCorrect={false} />
          <Chips options={stageChips(data.data)} value={stage} onChange={choose} />
          {data.loading && !data.data ? <Loading what="Loading your leads…" /> : null}
          {data.failure ? <LoadFailed failure={data.failure} onRetry={data.refresh} stale={!!data.data} /> : null}
          {data.data && rows.length === 0 ? (
            <Card>
              <AppText color="textMuted">{search ? 'No lead matches.' : 'No leads here.'}</AppText>
            </Card>
          ) : null}
          {rows.map((p) => {
            const line = leadLine(p, today, houseDay);
            const initials = (p.full_name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.full_name ?? 'Lead'}, ${line.text}`}
                onPress={() => router.push({ pathname: '/lead', params: { id: p.id } })}
                style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.lg, gap: t.space.md }]}
              >
                <View style={[styles.avatar, { backgroundColor: t.colors.infoSoft }]}>
                  <AppText variant="bodyStrong" color="onInfoSoft">
                    {initials || '?'}
                  </AppText>
                </View>
                <View style={styles.grow}>
                  <View style={styles.between}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={styles.grow}>
                      {p.full_name ?? 'Lead'}
                    </AppText>
                    <AppText variant="caption" color="textSubtle">
                      {houseDay(kuwaitDay(p.created_at))}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="textMuted" numberOfLines={1}>
                    {[p.course_interest_name, p.referred_by_name ? `via ${p.referred_by_name}` : null].filter(Boolean).join(' · ') || 'No course chosen yet'}
                  </AppText>
                  <AppText variant="caption" color={toneColor[line.tone]}>
                    {line.text}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
          {data.data && data.data.total_pages > 1 ? (
            <AppText variant="caption" color="textSubtle">{`Page ${data.data.page} of ${data.data.total_pages} · ${data.data.total} leads`}</AppText>
          ) : null}
          {data.data && data.data.page < data.data.total_pages ? <Button title="Next page" variant="outline" onPress={() => setPage(page + 1)} /> : null}
          {data.data && page > 1 ? <Button title="Previous page" variant="outline" onPress={() => setPage(page - 1)} /> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  figures: { flexDirection: 'row' },
  figure: { flex: 1, borderWidth: 1, padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, minHeight: minTouch },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
