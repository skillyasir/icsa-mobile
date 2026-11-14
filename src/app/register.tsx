import { RegisterScreen } from '@/reception/RegisterScreen';

// Register a student — pushed from reception's Today and New. The AMS answers
// only a manager, supervisor or marketer (POST /students).
export default function Register() {
  return <RegisterScreen />;
}
