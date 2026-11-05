// The messages the AMS security-check page (S1, client/public/mobile/captcha.html)
// posts to the app. captchaMessage.check.ts reads that page and fails if the
// two ever disagree on the source tag, the version or the message types.
//
//   { "source": "icsa-captcha", "v": 1, "type": "ready" | "token" | "expired"
//                                         | "timeout" | "error", "token", "code" }
//
// Anything else — another page, another version, a malformed token — is
// ignored, never guessed at.

export const CAPTCHA_SOURCE = 'icsa-captcha';
export const CAPTCHA_VERSION = 1;
export const CAPTCHA_TYPES = ['ready', 'token', 'expired', 'timeout', 'error'] as const;

export type CaptchaEvent =
  | { type: 'ready' }
  | { type: 'token'; token: string }
  | { type: 'expired' }
  | { type: 'timeout' }
  | { type: 'error'; code: string };

/** Turnstile tokens are opaque and long; refuse anything that cannot be one. */
const TOKEN_SHAPE = /^[A-Za-z0-9._\-:]{20,4096}$/;

export function parseCaptchaMessage(data: unknown): CaptchaEvent | null {
  let m: unknown = data;
  if (typeof data === 'string') {
    try {
      m = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.source !== CAPTCHA_SOURCE || o.v !== CAPTCHA_VERSION) return null;
  switch (o.type) {
    case 'ready':
    case 'expired':
    case 'timeout':
      return { type: o.type };
    case 'token':
      return typeof o.token === 'string' && TOKEN_SHAPE.test(o.token) ? { type: 'token', token: o.token } : null;
    case 'error':
      return { type: 'error', code: typeof o.code === 'string' ? o.code.slice(0, 40) : '' };
    default:
      return null;
  }
}

/** The only places the security-check WebView may load. */
export const CAPTCHA_ORIGINS = ['https://app.icsasystem.com', 'https://challenges.cloudflare.com'] as const;

/**
 * May the WebView load this URL? An allowed ORIGIN, matched up to its end —
 * `https://app.icsasystem.com.evil.com` starts with the AMS's address and is
 * somebody else's site. `about:` covers the blank frames Turnstile draws in.
 */
export function isAllowedCaptchaUrl(url: string): boolean {
  if (/^about:(blank|srcdoc)$/.test(url)) return true;
  return CAPTCHA_ORIGINS.some((o) => url === o || url.startsWith(o + '/') || url.startsWith(o + '?'));
}
