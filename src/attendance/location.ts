// Reading the phone's position for a check-in — and only for a check-in
// (Yasir ruled, 6 Nov 2026: the location is read only when the student taps
// Check in). Asked "while using the app" only: the app never asks for
// background location, and nothing here runs unless a check-in called it.

import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { LOCATION_TIMEOUT_MS, type Fix, type LocationFailure } from './rules';

export type FixResult =
  | { ok: true; fix: Fix; approximate: boolean }
  | { ok: false; why: LocationFailure; settings: boolean };

/** One position, now. `settings` = the student must change it in Settings. */
export async function readFix(): Promise<FixResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return { ok: false, why: 'services_off', settings: false };
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return { ok: false, why: 'denied', settings: !perm.canAskAgain };
    // Precise location switched off (iOS "Precise: Off", Android "approximate"):
    // the fix is sent anyway — the AMS decides — and the student is told why
    // a refusal may follow.
    const approximate = perm.ios?.accuracy === 'reduced' || perm.android?.accuracy === 'coarse';

    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
    ]);
    if (!pos) return { ok: false, why: 'timeout', settings: false };
    const acc = pos.coords.accuracy;
    const fix: Fix = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: acc != null && Number.isFinite(acc) ? Math.round(acc) : null,
    };
    // S6: whether the phone itself called the position simulated (a mock
    // provider on Android, software simulation on iOS). Sent as it is; the AMS
    // keeps such a check-in for review rather than refusing it.
    if (typeof pos.mocked === 'boolean') fix.mocked = pos.mocked;
    return { ok: true, fix, approximate };
  } catch {
    return { ok: false, why: 'unavailable', settings: false };
  }
}

export function openSettings(): void {
  Linking.openSettings().catch(() => {});
}
