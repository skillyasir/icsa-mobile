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

// Google sign-in (S12, 6 Nov 2026). Client IDs are public, not secrets.
/** The AMS website's Google client ("web client"). The app asks Google for a
 * token for it, so the AMS checks the app's tokens the way it checks the
 * website's (AMS authController googleAudiences()). */
export const GOOGLE_WEB_CLIENT_ID = '834637605414-rh4f6dci5gkqv7uhc6rqi9semnvg8tpa.apps.googleusercontent.com';
/** The iPhone app's own Google client (bundle us.icsa.app). Its reversed form is
 * the URL scheme in app.json, which Google's sign-in page returns through. */
export const GOOGLE_IOS_CLIENT_ID = '834637605414-p01k9vro3eiqilr45c51cuidu0tueefc.apps.googleusercontent.com';
