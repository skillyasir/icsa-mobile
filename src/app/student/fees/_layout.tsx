import { Stack } from 'expo-router';

// The Fees tab is a stack: the fees, and Payment proof pushed over it.
export const unstable_settings = { initialRouteName: 'index' };

export default function FeesStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
