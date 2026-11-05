// Where the app finds the AMS. One place, so no screen hard-codes an address.
export const AMS_WEB_URL = 'https://app.icsasystem.com';
export const AMS_API_URL = `${AMS_WEB_URL}/api`;
export const FORGOT_PASSWORD_URL = `${AMS_WEB_URL}/forgot-password`;

// Where the Update screen sends someone whose app is too old (S4).
/** Google Play: the package id is fixed (us.icsa.app), so the page address is known now. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=us.icsa.app';
/** App Store: its address carries a number Apple gives when the App Store Connect record is made
 * (docs/04-store-checklist.md). Until then null, and the Update screen names the store without a button. */
export const APP_STORE_URL: string | null = null;
