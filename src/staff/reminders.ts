// Staff attendance reminders — local notifications on this phone only
// (Yasir, 11 Nov 2026: reminders go to the person only; nothing is sent to the
// server and no push server is needed). Planned by rules.reminderPlan from
// My day; held on the phone so a reminder still comes on a day the app was
// never opened.
//
// No personal data on the lock screen (CLAUDE.md): the text says what is due,
// never a name.
//
// The module is required LAZILY: a phone on a build from before it was added
// would crash at import, so there the reminders are simply off.

import { Platform } from 'react-native';

import { REMINDER_PREFIX, type Reminder } from './rules';

type NotificationsModule = typeof import('expo-notifications');

let mod: NotificationsModule | null | undefined;
const CHANNEL = 'staff-attendance';

function load(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('expo-notifications') as NotificationsModule;
    // A reminder that arrives while ICSA is open still shows.
    m.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    mod = m;
  } catch (err) {
    console.warn('[reminders] expo-notifications is not in this build:', err instanceof Error ? err.message : String(err));
    mod = null;
  }
  return mod;
}

/** Asked once, from My day — the moment the reminders mean something to the person. */
async function allowed(m: NotificationsModule): Promise<boolean> {
  const now = await m.getPermissionsAsync();
  if (now.granted) return true;
  if (!now.canAskAgain) return false;
  return (await m.requestPermissionsAsync()).granted;
}

async function cancelStaff(m: NotificationsModule): Promise<void> {
  const all = await m.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(REMINDER_PREFIX)).map((n) => m.cancelScheduledNotificationAsync(n.identifier)));
}

/** Replace every staff reminder on this phone with this plan. Never throws. */
export async function applyReminders(plan: Reminder[]): Promise<void> {
  const m = load();
  if (!m) return;
  try {
    await cancelStaff(m);
    if (plan.length === 0 || !(await allowed(m))) return;
    if (Platform.OS === 'android') {
      await m.setNotificationChannelAsync(CHANNEL, { name: 'Attendance reminders', importance: m.AndroidImportance.DEFAULT });
    }
    for (const r of plan) {
      const at = Date.parse(r.at);
      if (!Number.isFinite(at) || at <= Date.now()) continue;
      await m.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: m.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  } catch (err) {
    console.warn('[reminders] could not plan the reminders:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Sign-out: every staff reminder goes, or the next person to use this phone
 * keeps the last person's. Never throws, never asks for permission.
 */
export async function clearReminders(): Promise<void> {
  const m = load();
  if (!m) return;
  try {
    await cancelStaff(m);
  } catch (err) {
    console.warn('[reminders] could not clear the reminders:', err instanceof Error ? err.message : String(err));
  }
}
