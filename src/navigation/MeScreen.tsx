import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Card, Screen } from '@/components/Screen';
import { EXPERIENCE_LABEL } from '@/lib/roles';
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
  const router = useRouter();
  const t = useAppTheme();
  if (!user) return null;

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

      <Button
        title="Sign out"
        variant="danger"
        onPress={() => {
          signOut();
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
  row: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center' },
});
