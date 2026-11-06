// Google and Apple sign-in (S12, 6 Nov 2026): which AMS endpoint a provider's
// token goes to, and under which field. Pure, so providerRoute.check.ts can
// hold it to the AMS's own routes and controllers.
//
//   google → POST /auth/google { credential }       (the website's own endpoint)
//   apple  → POST /auth/apple  { identity_token }
//
// Both answer exactly as the password sign-in does, so the session client goes
// on to bind this phone (POST /mobile/session) the same way. Neither has the
// Cloudflare check: Google and Apple have already checked the person.

export type Provider = 'google' | 'apple';

export const PROVIDER_ROUTES = {
  google: { path: '/auth/google', field: 'credential' },
  apple: { path: '/auth/apple', field: 'identity_token' },
} as const satisfies Record<Provider, { path: string; field: string }>;

export function providerRoute(provider: Provider, token: string): { path: string; body: Record<string, string> } {
  const r = PROVIDER_ROUTES[provider];
  return { path: r.path, body: { [r.field]: token } };
}

/** The URL scheme iOS returns to after Google's page: the client id reversed. */
export function googleUrlScheme(iosClientId: string): string {
  return 'com.googleusercontent.apps.' + iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
}
