import { Redirect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Screen';
import { AMS_WEB_URL } from '@/config';
import { useSession } from '@/session/SessionContext';

/** For roles the app has no screens for yet — they keep using the AMS on the web. */
export default function WebOnly() {
  const { user, signOut } = useSession();
  const router = useRouter();
  if (!user) return <Redirect href="/sign-in" />;

  return (
    <Screen title="Use the AMS on the web">
      <Card>
        <AppText>
          Your role works in the full AMS on a computer. The app does not have screens for it yet.
        </AppText>
        <Button title="Open the AMS" onPress={() => WebBrowser.openBrowserAsync(AMS_WEB_URL)} />
      </Card>
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
