import { Stack } from 'expo-router';

// Reception's Students tab is a stack: find a student, and their profile pushed over it.
export const unstable_settings = { initialRouteName: 'index' };

export default function ReceptionStudentsStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
