import { Redirect } from 'expo-router';

import { HOME } from '@/navigation/tabs';
import { useSession } from '@/session/SessionContext';

/** The start: sign in, or go to the person's own tabs. */
export default function Start() {
  const { user, active } = useSession();
  if (!user) return <Redirect href="/sign-in" />;
  if (!active) return <Redirect href="/web-only" />;
  return <Redirect href={HOME[active]} />;
}
