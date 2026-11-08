import { Stack } from 'expo-router';

// The Students tab is a stack: the list, and one student pushed over it.
export const unstable_settings = { initialRouteName: 'index' };

export default function StudentsStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
