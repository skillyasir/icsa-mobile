import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Pill } from '@/components/Pill';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { AMS_WEB_URL } from '@/config';
import { COUPON_TERMS, kdShort, waShareUrl } from '@/marketer/more';
import { BackLink, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import {
  AMBASSADOR_API,
  ageOf,
  codeFor,
  createLabel,
  currentCode,
  day,
  footnote,
  friendLine,
  friendName,
  friendsOf,
  fromOldSystem,
  historyLine,
  imageUrl,
  issueBody,
  monthLine,
  offerLine,
  progressPct,
  rewardOf,
  shareMessage,
  soonest,
  statusOf,
  type Code,
  type Mine,
} from './ambassador';

// Student › Ambassador (Yasir, 15 Nov 2026; mockups approved that day): your
// reward, the code to share now — Send on WhatsApp (the website's message, the
// voucher picture on top) or Share the voucher picture — a code for another
// friend, and your friends' progress. The AMS decides every part of it.

type Outcome = { tone: 'success' | 'danger'; text: string };

export function AmbassadorScreen() {
  const t = useAppTheme();
  const { user } = useSession();
  const live = !user?.preview;
  const mine = useAmsGet<Mine>(AMBASSADOR_API.me.path, live);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const top = <BackLink label="‹ Home" fallback="/student" />;
  if (!live) {
    return (
      <Screen title="Ambassador" top={top}>
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      </Screen>
    );
  }

  // Shared — said to the AMS after the share (the website does the same); a failure here changes nothing.
  const markShared = (c: Code) => {
    void ams.request('POST', AMBASSADOR_API.shared.path, { id: c.id }).then(() => mine.reload());
  };

  const sendWhatsApp = async (c: Code) => {
    setOutcome(null);
    try {
      await Linking.openURL(waShareUrl(shareMessage(c, AMS_WEB_URL), c.friend_whatsapp));
      markShared(c);
    } catch {
      setOutcome({ tone: 'danger', text: 'WhatsApp could not be opened on this phone.' });
    }
  };

  const sharePicture = async (c: Code) => {
    setOutcome(null);
    setSharing(true);
    try {
      const dest = new File(Paths.cache, `ICSA-${c.code}-status.png`);
      try {
        if (dest.exists) dest.delete();
      } catch {
        // an old copy that will not go is overwritten below or refused there
      }
      let file: File;
      try {
        file = await File.downloadFileAsync(imageUrl(AMS_WEB_URL, c.id), dest, { headers: { Accept: 'image/png' }, idempotent: true });
      } catch (err) {
        console.warn('[ambassador] the voucher picture did not come:', err instanceof Error ? err.message : String(err));
        return setOutcome({ tone: 'danger', text: 'The voucher picture could not be made. Try once more.' });
      }
      if (!(await Sharing.isAvailableAsync())) return setOutcome({ tone: 'danger', text: 'This phone has no app to share the picture with.' });
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share the voucher' });
      markShared(c);
    } catch (err) {
      console.warn('[ambassador] sharing failed:', err instanceof Error ? err.message : String(err));
      setOutcome({ tone: 'danger', text: 'The voucher picture could not be shared.' });
    } finally {
      setSharing(false);
    }
  };

  const create = async () => {
    setOutcome(null);
    const b = issueBody(name, phone);
    if (!b.ok) return setOutcome({ tone: 'danger', text: b.message });
    setSaving(true);
    try {
      const r = await ams.request<{ coupon?: { code: string } }>('POST', AMBASSADOR_API.issue.path, b.body);
      if (r.ok) {
        setOutcome({ tone: 'success', text: r.value.coupon?.code ? `Your new code is ${r.value.coupon.code}` : 'Your new code is ready.' });
        setName('');
        setPhone('');
      } else setOutcome({ tone: 'danger', text: r.failure.message });
      await mine.reload();
    } finally {
      setSaving(false);
    }
  };

  const m = mine.data;
  if (!m) {
    return (
      <Screen title="Ambassador" top={top} refreshing={mine.refreshing} onRefresh={mine.refresh}>
        {mine.failure ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} /> : <Loading what="Loading the programme…" />}
      </Screen>
    );
  }
  if (!m.wallet) {
    return (
      <Screen title="Ambassador" top={top} refreshing={mine.refreshing} onRefresh={mine.refresh}>
        <Notice tone="info">The Ambassador programme is being upgraded — please check back soon.</Notice>
      </Screen>
    );
  }

  const w = m.wallet;
  const codes = m.codes ?? [];
  const current = currentCode(codes);
  const friends = friendsOf(codes);
  const soon = soonest(codes);
  const first = (m.name || '').split(/\s+/)[0];
  const a = m.allowance;
  // The AMS's age rule (students aged 18 and over): when not eligible, no offer and no form —
  // its message where the form was (allowance.blocked carries it). Earlier codes and the wallet still show.
  const age = ageOf(m);
  const valid = !!name.trim() && phone.replace(/\D/g, '').length >= 8;

  return (
    <Screen title="Ambassador" top={top} refreshing={mine.refreshing} onRefresh={mine.refresh}>
      {mine.failure ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} stale /> : null}

      <View style={[styles.hero, { backgroundColor: t.colors.hero, borderRadius: t.radius.xl, gap: t.space.sm }]}>
        <View style={styles.between}>
          <View style={styles.grow}>
            <AppText variant="title" color="onHero">{first ? `Hi ${first}` : 'Hi'}</AppText>
            <AppText variant="caption" color="onHeroMuted">ICSA Ambassador</AppText>
          </View>
          <View style={styles.right}>
            <AppText variant="title" color="onHero">{kdShort(w.balance)}</AppText>
            <AppText variant="caption" color="onHeroMuted">{`earned${w.pending ? ` · ${kdShort(w.pending)} on the way` : ''}`}</AppText>
          </View>
        </View>
        {soon ? (
          <View style={[styles.soon, { borderRadius: t.radius.sm }]}>
            <AppText variant="caption" color="onHero">{`${kdShort(rewardOf(soon))} on the way — arrives ${day(soon.earns_on_any)}`}</AppText>
          </View>
        ) : null}
        {age.eligible ? <AppText color="onHero">{offerLine(m)}</AppText> : null}
      </View>

      {outcome ? <Notice tone={outcome.tone}>{outcome.text}</Notice> : null}

      {current ? (
        <View style={[styles.code, { backgroundColor: t.colors.surface, borderColor: t.colors.primary, borderRadius: t.radius.xl, gap: t.space.sm }]}>
          <Label>YOUR CODE</Label>
          <AppText variant="title" style={styles.mono} selectable accessibilityLabel={`Your code ${current.code.split('').join(' ')}`}>
            {current.code}
          </AppText>
          <AppText color="textMuted" style={styles.center}>{codeFor(current)}</AppText>
          <Button title="Send on WhatsApp" variant="success" onPress={() => void sendWhatsApp(current)} />
          <Button title="Share the voucher picture" variant="outline" busy={sharing} disabled={sharing} onPress={() => void sharePicture(current)} />
          <AppText variant="caption" color="textSubtle">
            {`Send on WhatsApp opens ${current.friend_name ? (current.friend_name.split(/\s+/)[0] + '’s') : 'the'} chat with the message typed in and the voucher picture on top. Share the picture for WhatsApp Status, Instagram and more.`}
          </AppText>
          <AppText variant="caption" color="textSubtle">{COUPON_TERMS}</AppText>
        </View>
      ) : age.eligible ? (
        <Card>
          <AppText color="textMuted">Create a code and share it with a friend who wants to study at ICSA.</AppText>
        </Card>
      ) : null}

      <Card>
        {a?.blocked ? (
          <AppText variant={age.eligible ? 'bodyStrong' : 'body'} color={age.eligible ? 'onWarningSoft' : 'textMuted'}>{a.blocked}</AppText>
        ) : (
          <>
            <Label>{current ? 'GIVE A CODE TO ANOTHER FRIEND' : 'WHO IS THE CODE FOR?'}</Label>
            <TextField label="Friend’s name" value={name} onChangeText={setName} autoCapitalize="words" autoCorrect={false} />
            <TextField label="Friend’s WhatsApp number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="e.g. 9XXX XXXX" />
            <AppText variant="caption" color="textSubtle">The code works only for this number.</AppText>
            <Button title={createLabel(name)} busy={saving} disabled={saving || !valid} onPress={() => void create()} />
            <AppText variant="caption" color="textSubtle" style={styles.center}>{monthLine(a)}</AppText>
          </>
        )}
      </Card>

      <Card>
        <Label>HOW YOU ARE PAID</Label>
        <AppText color="textMuted">ICSA pays your reward in cash, or takes it off your own course fees — ask at the front desk.</AppText>
      </Card>

      <Card>
        <Label>MY FRIENDS</Label>
        {friends.length === 0 ? <AppText color="textMuted">Nobody has used your codes yet.</AppText> : null}
        {friends.map((c, i) => {
          const st = statusOf(c);
          const pct = progressPct(c);
          return (
            <View key={c.id} style={[styles.friend, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.space.md }]}>
              <View style={styles.grow}>
                <AppText variant="headline">{friendName(c) + (fromOldSystem(c) ? ' · from old system' : '')}</AppText>
                <AppText variant="caption" color="textMuted">{friendLine(c, m.cooling_days)}</AppText>
                {pct !== null ? (
                  <View style={[styles.track, { backgroundColor: t.colors.border, borderRadius: t.radius.pill }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
                    <View style={[styles.fill, { width: `${pct}%`, backgroundColor: t.colors.attention, borderRadius: t.radius.pill }]} />
                  </View>
                ) : null}
              </View>
              <Pill text={st.label} tone={st.tone} />
            </View>
          );
        })}
      </Card>

      {w.lines?.length ? (
        <Card>
          <Label>REWARD HISTORY</Label>
          {w.lines.map((l) => {
            const h = historyLine(l);
            return (
              <View key={l.id} style={styles.between}>
                <AppText variant="caption" color="textMuted" style={styles.grow} numberOfLines={1}>{h.left}</AppText>
                <AppText variant="caption" color={h.minus ? 'onDangerSoft' : 'onSuccessSoft'}>{h.right}</AppText>
              </View>
            );
          })}
        </Card>
      ) : null}

      <AppText variant="caption" color="textSubtle" style={styles.center}>{footnote(m.cooling_days)}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 16 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  grow: { flex: 1 },
  right: { alignItems: 'flex-end' },
  soon: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 6 },
  code: { borderWidth: 2, borderStyle: 'dashed', padding: 16 },
  mono: { fontFamily: 'Menlo', letterSpacing: 2, textAlign: 'center' },
  center: { textAlign: 'center' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { height: 6, marginTop: 6, overflow: 'hidden' },
  fill: { height: '100%' },
});
