import { TakePaymentScreen } from '@/reception/TakePaymentScreen';

// Take a payment — pushed from reception's Today and New. The AMS answers only
// a manager or supervisor (POST /payments).
export default function TakePayment() {
  return <TakePaymentScreen />;
}
