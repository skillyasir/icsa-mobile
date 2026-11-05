import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { DEVICE } from '@/api/client';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { EXPERIENCE_LABEL } from '@/lib/roles';
import { useLock } from '@/lock/LockProvider';
import { LOCK_AFTER_MS } from '@/lock/lockRule';
import { useSession } from '@/session/SessionContext';
import { minTouch } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

import { HOME } from './tabs';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

/** The Me tab of every experience: who you are, switch view, sign out. */
export function MeScreen() {
  const { user, experiences, active, setActive, signOut } = useSession();
  const lock = useLock();
  const router = useRouter();
  const t = useAppTheme();
  if (!user) return null;
  // What the AMS said about this person: their branch, and their student code
  // (given at sign-in) or email.
  const details = [user.branch_name, user.student_code ?? user.email].filter(Boolean).join(' · ');

  return (
    <Screen title="Me">
      <Card>
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: t.colors.infoSoft }]}>
            <AppText variant="headline" color="onInfoSoft">
              {initials(user.full_name)}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="headline">{user.full_name}</AppText>
            <AppText variant="caption" color="textSubtle">
              {active ? EXPERIENCE_LABEL[active] : 'No app view'}
            </AppText>
            {details ? (
              <AppText variant="caption" color="textSubtle">
                {details}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>

      {user.preview ? (
        <Notice tone="warning" title="Developer preview">
          This is a made-up person for testing the screens. Nothing here comes from the AMS yet.
        </Notice>
      ) : null}

      {experiences.length > 1 ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            SWITCH VIEW
          </AppText>
          <Card>
            {experiences.map((e) => {
              const on = e === active;
              return (
                <Pressable
                  key={e}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    setActive(e);
                    router.replace(HOME[e]);
                  }}
                  style={styles.row}
                >
                  <AppText variant={on ? 'bodyStrong' : 'body'} style={styles.flex}>
                    {EXPERIENCE_LABEL[e]}
                  </AppText>
                  <AppText variant="bodyStrong" color="link">
                    {on ? '✓' : ''}
                  </AppText>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ) : null}

      {!user.preview ? (
        <View style={{ gap: t.space.sm }}>
          <AppText variant="label" color="textMuted">
            THIS PHONE
          </AppText>
          <Card>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="body">Lock with {lock.ability.method}</AppText>
                <AppText variant="caption" color="textSubtle">
                  {lock.ability.available
                    ? `After ${LOCK_AFTER_MS / 60_000} minutes away, ICSA asks for ${lock.ability.method}.`
                    : 'Set up Face ID, a fingerprint or a passcode in the phone’s Settings to use this.'}
                </AppText>
              </View>
              <Switch
                value={lock.ability.available && lock.wanted}
                disabled={!lock.ability.available}
                onValueChange={(on) => {
                  lock.setWanted(on);
                }}
                accessibilityLabel={`Lock with ${lock.ability.method}`}
              />
            </View>
          </Card>
        </View>
      ) : null}

      <AppText variant="caption" color="textSubtle" style={styles.centred}>
        ICSA app version {DEVICE.appVersion ?? 'unknown'}
      </AppText>

      <Button
        title="Sign out"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: 12 },
  centred: { textAlign: 'center' },
});
