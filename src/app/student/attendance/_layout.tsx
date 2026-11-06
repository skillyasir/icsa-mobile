import { Stack } from 'expo-router';

// The Attendance tab is a stack: the list, and Check in pushed over it (Home's
// Check in button lands here too, so going back shows the Attendance list).
export const unstable_settings = { initialRouteName: 'index' };

export default function AttendanceStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
