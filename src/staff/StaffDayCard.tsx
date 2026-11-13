import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatClock } from '@/attendance/rules';
import { useAmsGet } from '@/attendance/useAmsGet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Screen';
import { useSession } from '@/session/SessionContext';

import { NOT_WORKING, STAFF_API, hours, tapOf, type MyDay } from './rules';

/**
 * The way into My day from a staff member's first screen: where their day
 * stands, and the button to the next tap. The tap itself is made on My day,
 * where the office check is explained and its result shown.
 */
export function StaffDayCard() {
  const router = useRouter();
  const { user } = useSession();
  const live = !!user && !user.preview && user.role !== 'student';
  const my = useAmsGet<MyDay>(STAFF_API.today.path, live);
  if (!live) return null;

  const day = my.data;
  const d = day?.day ?? null;
  const first = day?.working ? (day.next[0] ?? null) : null;
  const inTap = day ? tapOf(day, 'in') : null;

  let line = 'Check in, lunch and check out.';
  if (day && (!day.working || !d)) line = NOT_WORKING[day.reason ?? 'no_week'];
  else if (day && d && !inTap) line = `Not checked in yet · ${hours(d.start_time, d.end_time)}`;
  else if (day && inTap && first) line = `Checked in at ${formatClock(inTap.time)}`;
  else if (day && inTap && !first) line = 'Day complete';

  return (
    <Card>
      <View style={styles.gap}>
        <AppText variant="headline">My day</AppText>
        <AppText color="textMuted">{line}</AppText>
      </View>
      <Button
        title="Open My day"
        variant={first === 'in' ? 'attention' : 'outline'}
        onPress={() => router.push('/my-day')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({ gap: { gap: 2 } });
