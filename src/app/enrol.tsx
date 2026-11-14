import { EnrolScreen } from '@/reception/EnrolScreen';

// Enrol a student — pushed from reception's Today, New and a new registration.
// The AMS answers only a manager or supervisor (POST /enrollments/full).
export default function Enrol() {
  return <EnrolScreen />;
}
