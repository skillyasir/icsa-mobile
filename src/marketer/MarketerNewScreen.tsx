import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { ams } from '@/api/client';
import { pathFor } from '@/api/paths';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { LoadFailed, Loading } from '@/components/States';
import { TextField } from '@/components/TextField';
import { AMS_WEB_URL } from '@/config';
import { houseDay } from '@/reception/money';
import { Chips, Label } from '@/reception/ui';
import { useSession } from '@/session/SessionContext';
import { useAppTheme } from '@/theme/useAppTheme';

import { MORE_API, couponBody, kdShort, linkLine, linkUrl, shareText, waShareUrl, type IssuedCoupon, type LeadLink, type RewardsMine } from './more';

// Marketer › New (bunch 2 board 2, approved 14 Nov 2026). Yasir ruled, 14 Nov
// 2026: staff never type a lead in — a lead comes from a source. So New gives
// a coupon (someone new becomes her lead — the AMS decides, and names another
// marketer who already has the person), shares her lead links, and registers a
// student (reception enrols them).

type Checked = { result: { tone: string; text: string } | null; state: string | null };

export function MarketerNewScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const { user } = useSession();
  const live = !user?.preview;
  const mine = useAmsGet<RewardsMine>(MORE_API.rewardsMine.path, live);
  const links = useAmsGet<{ links: LeadLink[] }>(MORE_API.links.path, live);
  const linkCourses = useAmsGet<{ courses: { id: number; name: string }[] }>(MORE_API.linkCourses.path, live);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);
  const [issued, setIssued] = useState<IssuedCoupon | null>(null);
  const [making, setMaking] = useState(false);

  // The AMS's own answer about this person before a code is made (POST /rewards/codes/check).
  const check = async () => {
    if (phone.replace(/\D/g, '').length < 8) return setChecked(null);
    const r = await ams.request<Checked>('POST', MORE_API.checkRecipient.path, { to_phone: phone.trim() });
    if (r.ok) setChecked(r.value);
  };

  const create = async () => {
    setMessage(null);
    const b = couponBody({ name, phone, courseId });
    if (!b.ok) return setMessage({ tone: 'warning', text: b.message });
    setBusy('coupon');
    try {
      const r = await ams.request<{ coupon: IssuedCoupon }>('POST', MORE_API.issueCode.path, b.body);
      if (!r.ok) return setMessage({ tone: 'danger', text: r.failure.message });
      setIssued(r.value.coupon);
      setName('');
      setPhone('');
      setChecked(null);
      await mine.reload();
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async (c: IssuedCoupon) => {
    const first = (c.to_name ?? '').trim().split(/\s+/)[0] || null;
    const text = shareText({ code: c.code, discount: c.discount_amount, validUntil: c.valid_until, course: c.course_name, firstName: first, id: c.id, origin: AMS_WEB_URL, day: (v) => houseDay(v.slice(0, 10)) });
    await Linking.openURL(waShareUrl(text, c.to_phone));
    // The website marks a code shared when it is sent; so does the app.
    await ams.request('POST', pathFor(MORE_API.markShared.path, { id: c.id }));
  };

  const newLink = async (linkCourseId: number | null) => {
    setMessage(null);
    setBusy('link');
    try {
      const r = await ams.request('POST', MORE_API.newLink.path, linkCourseId ? { link_course_id: linkCourseId } : {});
      if (!r.ok) return setMessage({ tone: 'danger', text: r.failure.message });
      setMaking(false);
      await links.reload();
    } finally {
      setBusy(null);
    }
  };

  const activeLinks = (links.data?.links ?? []).filter((l) => l.is_active !== false);

  return (
    <Screen title="New" refreshing={links.refreshing} onRefresh={live ? links.refresh : undefined}>
      {!live ? (
        <Notice tone="warning" title="Developer preview">
          This person has no AMS account.
        </Notice>
      ) : (
        <>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          <Card>
            <AppText variant="headline">Give a coupon</AppText>
            <AppText color="textMuted">Their name and mobile, the course. Someone new becomes your lead; someone another marketer already has is named, and gets no code.</AppText>
            {issued ? (
              <View style={{ gap: t.space.sm }}>
                <Notice tone="success" title={`Code ${issued.code}`}>
                  {`${kdShort(issued.discount_amount)} off for ${issued.to_name ?? 'them'}${issued.valid_until ? ` · valid until ${houseDay(issued.valid_until.slice(0, 10))}` : ''}.`}
                </Notice>
                <Button title="Send it on WhatsApp" variant="success" onPress={() => sendCode(issued)} />
                <Button title="Give another" variant="outline" onPress={() => setIssued(null)} />
              </View>
            ) : (
              <View style={{ gap: t.space.sm }}>
                <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
                <TextField label="Mobile" value={phone} onChangeText={(v) => { setPhone(v); setChecked(null); }} onBlur={check} keyboardType="phone-pad" />
                {checked?.result ? <Notice tone={checked.result.tone === 'blocked' ? 'danger' : 'info'}>{checked.result.text}</Notice> : null}
                <Label>COURSE (OPTIONAL)</Label>
                {mine.failure ? <LoadFailed failure={mine.failure} onRetry={mine.refresh} stale={!!mine.data} /> : null}
                <Chips options={(mine.data?.courses ?? []).map((c) => ({ value: c.id, label: c.name }))} value={courseId} onChange={(v) => setCourseId(v === courseId ? null : v)} />
                <Button title="Create the code" variant="primary" busy={busy === 'coupon'} disabled={busy !== null || checked?.state === 'refused'} onPress={create} />
              </View>
            )}
          </Card>

          <Card>
            <AppText variant="headline">Share your lead link</AppText>
            {links.loading && !links.data ? <Loading what="Loading your links…" /> : null}
            {links.failure ? <LoadFailed failure={links.failure} onRetry={links.refresh} stale={!!links.data} /> : null}
            {links.data && activeLinks.length === 0 ? <AppText color="textMuted">No link yet — make one below.</AppText> : null}
            {activeLinks.map((l) => (
              <View key={l.id} style={[styles.between, { gap: t.space.sm }]}>
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{l.course_label ?? 'All courses'}</AppText>
                  <AppText variant="caption" color="textSubtle">
                    {linkLine(l)}
                  </AppText>
                </View>
                <Button title="Share" variant="success" block={false} onPress={() => Share.share({ message: linkUrl(l.token) })} />
              </View>
            ))}
            {making ? (
              <View style={{ gap: t.space.sm }}>
                <Label>WHICH COURSE IS IT FOR?</Label>
                <Chips options={[{ value: '0', label: 'All courses' }, ...(linkCourses.data?.courses ?? []).map((c) => ({ value: String(c.id), label: c.name }))]} value={null} onChange={(v) => newLink(v === '0' ? null : Number(v))} disabled={busy !== null} />
                <Button title="Cancel" variant="outline" onPress={() => setMaking(false)} />
              </View>
            ) : (
              <Button title="+ Make a new link" variant="outline" onPress={() => setMaking(true)} />
            )}
          </Card>

          <Card>
            <AppText variant="headline">Register a student</AppText>
            <AppText color="textMuted">Their details from the Civil ID. Reception enrols them and takes the fee.</AppText>
            <Button title="Register a student" variant="outline" onPress={() => router.push('/register')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});
