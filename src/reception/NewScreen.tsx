import { useRouter } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Screen';

// Reception › New (14 Nov 2026): the three things reception starts — the same
// three as Today's tiles. Each opens its own screen over the tabs.

export function NewScreen() {
  const router = useRouter();
  return (
    <Screen title="New">
      <Card>
        <AppText variant="headline">Register a student</AppText>
        <AppText color="textMuted">Their details from the Civil ID or passport, then their contact details.</AppText>
        <Button title="Register a student" variant="primary" onPress={() => router.push('/register')} />
      </Card>
      <Card>
        <AppText variant="headline">Enrol in a course</AppText>
        <AppText color="textMuted">A course, a batch or their own days, the fee plan and the first payment — saved together.</AppText>
        <Button title="Enrol a student" variant="outline" onPress={() => router.push('/enrol')} />
      </Card>
      <Card>
        <AppText variant="headline">Take a payment</AppText>
        <AppText color="textMuted">An instalment, the balance or another amount, then send the receipt.</AppText>
        <Button title="Take a payment" variant="success" onPress={() => router.push('/take-payment')} />
      </Card>
    </Screen>
  );
}
