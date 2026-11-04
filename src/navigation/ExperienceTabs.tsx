import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import type { Experience } from '@/lib/roles';
import { useSession } from '@/session/SessionContext';
import { font } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { TABS } from './tabs';

/**
 * The native tab bar of one experience (iOS tab bar, Android Material
 * navigation bar). Sends anyone who may not see these tabs back to the start.
 * The guard is for the screens only — the AMS API refuses the data anyway.
 */
export function ExperienceTabs({ experience }: { experience: Experience }) {
  const { user, experiences } = useSession();
  const t = useAppTheme();

  if (!user) return <Redirect href="/sign-in" />;
  if (!experiences.includes(experience)) return <Redirect href="/" />;

  return (
    <NativeTabs
      tintColor={t.colors.link}
      labelStyle={{ fontFamily: font.bold }}
    >
      {TABS[experience].map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
