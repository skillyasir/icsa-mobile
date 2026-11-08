import { Stack } from 'expo-router';

// The Learn tab is a stack: the course and its subjects, a subject, an assignment.
export const unstable_settings = { initialRouteName: 'index' };

export default function LearnStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
