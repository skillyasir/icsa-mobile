import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';

import {
  CAPTCHA_SOURCE,
  CAPTCHA_TYPES,
  CAPTCHA_VERSION,
  isAllowedCaptchaUrl,
  parseCaptchaMessage,
} from './captchaMessage.ts';

// The app reads what the AMS security-check page (S1) posts. This check holds
// the two to one protocol by reading the page itself, and pins the URL rule
// that keeps the WebView on the AMS and Cloudflare.

run('captchaMessage.check — the security-check page and the app agree', (h) => {
  const msg = (o: object) => JSON.stringify({ source: CAPTCHA_SOURCE, v: CAPTCHA_VERSION, ...o });
  const TOKEN = '0.' + 'a'.repeat(60) + '-_:.' + 'Z'.repeat(20);

  // §1 the page's protocol, read from the page
  const page = readAmsFile('client/public/mobile/captcha.html');
  const script = page.slice(page.indexOf('<script>'));
  h.check('§1 extraction floor: the page and its script are there', page.length > 2000 && script.length > 1000, `${page.length} / ${script.length}`);
  h.check(`§1 the page tags its messages source '${CAPTCHA_SOURCE}', v ${CAPTCHA_VERSION}`,
    script.includes(`source: '${CAPTCHA_SOURCE}', v: ${CAPTCHA_VERSION}`));
  const sent = [...new Set([...script.matchAll(/send\('([a-z]+)'/g)].map((m) => m[1]))].sort();
  h.check('§1 the page sends five types (cardinality floor)', sent.length === 5, sent.join(','));
  h.check('§1 …and they are the five the app reads', sent.join() === [...CAPTCHA_TYPES].sort().join(), `${sent} vs ${[...CAPTCHA_TYPES].sort()}`);
  h.check('§1 the token travels as "token", the error as "code"', /send\('token', \{ token: token \}\)/.test(script) && /send\('error', \{ code:/.test(script));
  h.check('§1 the page offers the reset the app calls after a failed sign-in', /window\.icsaCaptchaReset = function/.test(script));

  // §2 parsing
  h.check('§2 a token message → the token', JSON.stringify(parseCaptchaMessage(msg({ type: 'token', token: TOKEN }))) === JSON.stringify({ type: 'token', token: TOKEN }));
  h.check('§2 ready / expired / timeout', ['ready', 'expired', 'timeout'].every((t) => parseCaptchaMessage(msg({ type: t }))?.type === t));
  h.check('§2 an error keeps its code', JSON.stringify(parseCaptchaMessage(msg({ type: 'error', code: 'script-load' }))) === JSON.stringify({ type: 'error', code: 'script-load' }));
  h.check('§2 an already-parsed object is read too', parseCaptchaMessage({ source: CAPTCHA_SOURCE, v: 1, type: 'ready' })?.type === 'ready');
  h.check('§2 another page\'s message → ignored', parseCaptchaMessage(JSON.stringify({ source: 'other', v: 1, type: 'token', token: TOKEN })) === null);
  h.check('§2 another version → ignored', parseCaptchaMessage(JSON.stringify({ source: CAPTCHA_SOURCE, v: 2, type: 'ready' })) === null);
  h.check('§2 an unknown type → ignored', parseCaptchaMessage(msg({ type: 'success' })) === null);
  h.check('§2 a token that cannot be one → ignored', [
    '', 'short', 'a'.repeat(5000), 'has space'.repeat(5), '<script>'.repeat(5),
  ].every((tok) => parseCaptchaMessage(msg({ type: 'token', token: tok })) === null));
  h.check('§2 not JSON, null, a number → ignored', [ 'not json', 'null', '7', null, 7 ].every((d) => parseCaptchaMessage(d) === null));

  // §3 where the WebView may go
  h.check('§3 the AMS page', isAllowedCaptchaUrl('https://app.icsasystem.com/mobile/captcha.html?theme=dark&v=1'));
  h.check('§3 Cloudflare\'s challenge', isAllowedCaptchaUrl('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/if/ov2'));
  h.check('§3 Turnstile\'s blank frames', isAllowedCaptchaUrl('about:blank') && isAllowedCaptchaUrl('about:srcdoc'));
  h.check('§3 NOT a look-alike host that starts with the AMS address', !isAllowedCaptchaUrl('https://app.icsasystem.com.evil.example/mobile/captcha.html'));
  h.check('§3 NOT a look-alike with a user part', !isAllowedCaptchaUrl('https://app.icsasystem.com@evil.example/'));
  h.check('§3 NOT plain http', !isAllowedCaptchaUrl('http://app.icsasystem.com/mobile/captcha.html'));
  h.check('§3 NOT another site', !isAllowedCaptchaUrl('https://example.com/') && !isAllowedCaptchaUrl('about:evil'));
});
