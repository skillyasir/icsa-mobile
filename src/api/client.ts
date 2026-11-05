// The one SessionClient the app uses, wired to this phone.
//
//   - the refresh token goes in the Keychain (iOS) / Keystore (Android) through
//     expo-secure-store — never AsyncStorage (CLAUDE.md). THIS_DEVICE_ONLY: it is
//     never synced to iCloud or restored onto another phone from a backup, where
//     it would be a copy of somebody's sign-in. AFTER_FIRST_UNLOCK: readable
//     after the phone has been unlocked once since it started, so a reminder or
//     a background refresh does not fail on a locked screen.
//   - the device name sent to the AMS is the MODEL ("iPhone 18 Pro"), not the
//     name the owner gave the phone, which is often their own name.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { AMS_API_URL } from '@/config';

import { SessionClient, type TokenStore } from './session';

const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const secureStore: TokenStore = {
  get: (key) => SecureStore.getItemAsync(key, KEYCHAIN),
  set: (key, value) => SecureStore.setItemAsync(key, value, KEYCHAIN),
  remove: (key) => SecureStore.deleteItemAsync(key, KEYCHAIN),
};

export const ams = new SessionClient({
  apiUrl: AMS_API_URL,
  fetch: (url, init) => fetch(url, init),
  store: secureStore,
  device: {
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    deviceName: Device.modelName ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
  },
});
