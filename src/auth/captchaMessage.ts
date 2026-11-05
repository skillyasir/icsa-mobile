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

/**
 * May the security-check WebView make this load? The WebView asks about every
 * load, Cloudflare's own inner frames included.
 *
 *   the page itself (top frame)  → only the AMS page or Cloudflare
 *   an inner frame                → yes. These are Turnstile's working frames
 *                                   (about:srcdoc, blob:…, its challenge);
 *                                   refusing them leaves the widget on
 *                                   "Verifying…" for ever (5 Nov 2026, the first
 *                                   Simulator run). They cannot reach the app:
 *                                   only the top frame has the message bridge,
 *                                   and a message from any other page is
 *                                   ignored by the view.
 */
export function captchaLoadDecision(r: { url: string; isTopFrame?: boolean }): boolean {
  if (r.isTopFrame === false) return true;
  return isAllowedCaptchaUrl(r.url);
}

/** The AMS security-check page (S1). */
export const CAPTCHA_PAGE_URL = 'https://app.icsasystem.com/mobile/captcha.html';
const AMS_ORIGIN = CAPTCHA_ORIGINS[0];

/**
 * Is a message from the security-check page? `from` is what the WebView says
 * sent it, and the two platforms say different things:
 *
 *   iOS (and Android's old bridge)   the page's own URL, query and all
 *   Android's message listener       only the sender's ORIGIN — and it listens
 *                                    to EVERY frame, Cloudflare's included
 *
 * Until 5 Nov 2026 the view accepted only the page URL, so on Android every
 * message — the token included — was thrown away and Sign in never woke up.
 * The AMS origin can only be the page itself here: captchaLoadDecision keeps
 * the window on the AMS page or Cloudflare, and Cloudflare's frames report
 * Cloudflare's origin, which is refused.
 */
export function isCaptchaMessageSource(from: string): boolean {
  if (from === CAPTCHA_PAGE_URL || from.startsWith(CAPTCHA_PAGE_URL + '?')) return true;
  return from === AMS_ORIGIN || from === AMS_ORIGIN + '/';
}
