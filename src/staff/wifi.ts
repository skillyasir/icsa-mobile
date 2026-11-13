// Reading the office Wi-Fi router for a staff tap — and only at a tap
// (Yasir, 11 Nov 2026: the location and the Wi-Fi are read when the person
// taps, never before and never in the background).
//
// The router's hardware address (BSSID) is what the AMS matches; the network
// name only helps a person tell routers apart. Both are sent exactly as the
// phone gives them — the AMS normalises the address.
//
// iPhone: needs the "Access Wi-Fi Information" entitlement and location
// permission (precise). Android: needs fine location and location services on;
// without them it reports a placeholder address, which the AMS reads as "no
// router". Location is asked for first, by readFix, at the same tap.
//
// The module is required LAZILY: a phone running a build from before it was
// added would crash at import. Such a phone says the Wi-Fi cannot be read.

import type { Wifi, WifiNote } from './rules';

type NetInfoModule = typeof import('@react-native-community/netinfo').default;

let netInfo: NetInfoModule | null | undefined;

function load(): NetInfoModule | null {
  if (netInfo !== undefined) return netInfo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-community/netinfo').default as NetInfoModule;
    m.configure({ shouldFetchWiFiSSID: true });
    netInfo = m;
  } catch (err) {
    console.warn('[wifi] NetInfo is not in this build:', err instanceof Error ? err.message : String(err));
    netInfo = null;
  }
  return netInfo;
}

export type WifiResult = Wifi & { note: WifiNote | null };

/** The Wi-Fi the phone is on now. Never throws. */
export async function readWifi(): Promise<WifiResult> {
  const m = load();
  if (!m) return { bssid: null, ssid: null, note: 'not_available' };
  try {
    const s = await m.fetch('wifi');
    if (String(s.type) !== 'wifi' || !s.isConnected) return { bssid: null, ssid: null, note: 'not_wifi' };
    const d = s.details as { bssid?: string | null; ssid?: string | null } | null;
    const bssid = d?.bssid ?? null;
    const ssid = d?.ssid ?? null;
    // Sent as given, placeholder or not (the AMS reads the placeholder as no
    // router); the note only tells the person why the check may fail.
    const placeholder = !bssid || /^0?2:0?0:0?0:0?0:0?0:0?0$/.test(bssid);
    return { bssid, ssid, note: placeholder ? 'no_address' : null };
  } catch (err) {
    console.warn('[wifi] could not read the Wi-Fi:', err instanceof Error ? err.message : String(err));
    return { bssid: null, ssid: null, note: 'not_available' };
  }
}
