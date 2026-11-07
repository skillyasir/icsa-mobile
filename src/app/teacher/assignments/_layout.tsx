import { Stack } from 'expo-router';

// The Assignments tab is a stack: the queue, and one submission pushed over it.
export const unstable_settings = { initialRouteName: 'index' };

export default function AssignmentsStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
