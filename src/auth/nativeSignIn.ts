// Asking Google or Apple, on this phone, for a token that proves who the person
// is (S12, 6 Nov 2026). The token goes to the AMS (providerRoute.ts), which
// decides whether it is an ICSA account; nothing here signs anyone in.
//
//   - Google: the token is for the AMS website's client (webClientId), so the
//     AMS checks it as it checks the website's. After the token is in hand the
//     phone forgets the Google choice, so the next sign-in asks which account
//     again — a shared phone, or a person with a work and a personal account.
//   - Apple: only the email is asked for (no name): the AMS uses a real email
//     to link a first sign-in; a hidden one is linked in Me instead.
//
// Every outcome is an answer, never a throw: a token, "cancelled" (the person
// closed the sheet — say nothing), or a message to show.

import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/config';

export type TokenResult =
  | { ok: true; token: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

const CANCELLED: TokenResult = { ok: false, cancelled: true };
const say = (message: string): TokenResult => ({ ok: false, cancelled: false, message });

export const GOOGLE_FAILED = 'Google sign-in did not finish. Please try again, or use your ICSA password.';
export const APPLE_FAILED = 'Sign in with Apple did not finish. Please try again, or use your ICSA password.';
export const NO_PLAY_SERVICES = 'Google sign-in needs Google Play services on this phone. Please use your ICSA password.';

let configured = false;
function configureGoogle(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
  configured = true;
}

export async function googleToken(): Promise<TokenResult> {
  try {
    configureGoogle();
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const r = await GoogleSignin.signIn();
    if (!isSuccessResponse(r)) return CANCELLED;
    const token = r.data.idToken;
    GoogleSignin.signOut().catch(() => {}); // forget the choice; the AMS session is what keeps them signed in
    return token ? { ok: true, token } : say(GOOGLE_FAILED);
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return CANCELLED;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return say(NO_PLAY_SERVICES);
    }
    return say(GOOGLE_FAILED);
  }
}

/** Sign in with Apple exists on iOS only (and needs iOS 13). */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function appleToken(): Promise<TokenResult> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    return cred.identityToken ? { ok: true, token: cred.identityToken } : say(APPLE_FAILED);
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === 'ERR_REQUEST_CANCELED') return CANCELLED;
    return say(APPLE_FAILED);
  }
}
