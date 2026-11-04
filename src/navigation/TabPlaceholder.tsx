import { AppText } from '@/components/AppText';
import { Card, Screen } from '@/components/Screen';
import { EXPERIENCE_LABEL, type Experience } from '@/lib/roles';

import { TABS } from './tabs';

/** Stands in for a tab until its real screen is built. Says what is coming, and when. */
export function TabPlaceholder({ experience, name }: { experience: Experience; name: string }) {
  const tab = TABS[experience].find((x) => x.name === name);
  if (!tab) throw new Error(`No tab "${name}" in the ${experience} tabs`);

  return (
    <Screen title={tab.label} eyebrow={EXPERIENCE_LABEL[experience]}>
      <Card>
        <AppText variant="headline">Coming in Phase {tab.phase}</AppText>
        <AppText color="textMuted">{tab.soon}</AppText>
      </Card>
    </Screen>
  );
}
