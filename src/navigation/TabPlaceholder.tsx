import * as WebBrowser from 'expo-web-browser';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Screen';
import { AMS_WEB_URL } from '@/config';
import { EXPERIENCE_LABEL, type Experience } from '@/lib/roles';
import { StaffDayCard } from '@/staff/StaffDayCard';

import { TABS } from './tabs';

/**
 * Stands in for a tab until its real screen is built: says what is coming, and
 * that the AMS website does it meanwhile (13 Nov 2026 — "Coming in Phase 3"
 * was the build plan's word, which staff testers could not read). A view's
 * first tab also carries My day, so every member of staff can check in.
 */
export function TabPlaceholder({ experience, name }: { experience: Experience; name: string }) {
  const tab = TABS[experience].find((x) => x.name === name);
  if (!tab) throw new Error(`No tab "${name}" in the ${experience} tabs`);

  return (
    <Screen title={tab.label} eyebrow={EXPERIENCE_LABEL[experience]}>
      {name === 'index' ? <StaffDayCard /> : null}
      <Card>
        <AppText variant="headline">Coming soon to the app</AppText>
        <AppText color="textMuted">{tab.soon}</AppText>
        <AppText color="textMuted">Until then, use the AMS website for this.</AppText>
        <Button title="Open the AMS website" variant="outline" onPress={() => WebBrowser.openBrowserAsync(AMS_WEB_URL)} />
      </Card>
    </Screen>
  );
}
