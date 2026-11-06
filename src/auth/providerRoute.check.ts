import { readFileSync } from 'node:fs';

import { readAmsFile } from '../../scripts/ams.ts';
import { run } from '../../scripts/check-harness.ts';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../config.ts';

import { PROVIDER_ROUTES, googleUrlScheme, providerRoute } from './providerRoute.ts';

// Google and Apple sign-in (S12, 6 Nov 2026) touch four places that must agree,
// and none of them would say so if they drifted apart — the button would just
// fail on a phone:
//   the app's route and field  ↔  the AMS route and the field its controller reads
//   the app's Google client ids ↔  the AMS website's client, and the AMS's list
//                                  of the app's clients (googleAudiences)
//   the iPhone client id        ↔  the URL scheme in app.json
//   the bundle id in app.json   ↔  the audience the AMS checks Apple's token for
// This check reads the AMS copy beside this repo; missing is COULD NOT RUN.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** The quoted client ids in a block of source, in order. */
const clientIds = (src: string) => [...src.matchAll(/'(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)'/g)].map((m) => m[1]);

run('providerRoute.check — Google and Apple sign-in agree with the AMS', (h) => {
  // §0 the extractors
  h.check('§0 clientIds reads ids in order', JSON.stringify(clientIds("x '1-ab.apps.googleusercontent.com', '2-cd.apps.googleusercontent.com'")) === JSON.stringify(['1-ab.apps.googleusercontent.com', '2-cd.apps.googleusercontent.com']));
  h.check('§0 clientIds finds none in plain text', clientIds('no ids here').length === 0);
  h.check('§0 strip keeps a URL (the :// is not a comment)', strip("a = 'https://x'; // gone").includes('https://x') && !strip("a = 1; // gone").includes('gone'));

  // §1 the routes and fields, against the AMS's own
  const routes = strip(readAmsFile('server/src/routes/auth.js'));
  h.check('§1 the AMS auth router was read', routes.length > 2000, String(routes.length));
  h.check('§1 the AMS has POST /google (mounted under /api/auth)', /router\.post\('\/google', googleLogin\);/.test(routes));
  h.check('§1 the AMS has POST /apple → appleLogin', /router\.post\('\/apple', appleLimiter, apple\.appleLogin\);/.test(routes));
  h.check('§1 the app asks /auth/google and /auth/apple', PROVIDER_ROUTES.google.path === '/auth/google' && PROVIDER_ROUTES.apple.path === '/auth/apple');

  const auth = strip(readAmsFile('server/src/controllers/authController.js'));
  const google = /const googleLogin = async[\s\S]*?\n};/.exec(auth)?.[0] ?? '';
  h.check('§1 the AMS googleLogin extracts (floor)', google.length > 1500, String(google.length));
  h.check('§1 …it reads the token from req.body.credential, the field the app sends',
    /const \{ credential \} = req\.body;/.test(google) && PROVIDER_ROUTES.google.field === 'credential');
  const appleCtl = strip(readAmsFile('server/src/controllers/appleSignInController.js'));
  const appleLogin = /const appleLogin = async[\s\S]*?\n};/.exec(appleCtl)?.[0] ?? '';
  h.check('§1 the AMS appleLogin extracts (floor)', appleLogin.length > 1500, String(appleLogin.length));
  h.check('§1 …it reads req.body.identity_token, the field the app sends',
    /req\.body && req\.body\.identity_token/.test(appleLogin) && PROVIDER_ROUTES.apple.field === 'identity_token');
  h.check('§1 …and so does link (Me › Sign in with Apple)',
    /const appleLink = async[\s\S]*?req\.body && req\.body\.identity_token/.test(appleCtl));
  const r = providerRoute('apple', 'T');
  h.check('§1 providerRoute builds { path, body: { field: token } }', r.path === '/auth/apple' && JSON.stringify(r.body) === '{"identity_token":"T"}');
  h.check('§1 control: a different field name is told apart', JSON.stringify(providerRoute('google', 'T').body) !== JSON.stringify(r.body));

  // §2 the Google client ids
  const envProd = readAmsFile('client/.env.production');
  const webId = /^REACT_APP_GOOGLE_CLIENT_ID=(\S+)$/m.exec(envProd)?.[1];
  h.check('§2 the app\'s web client id is the AMS website\'s', !!webId && webId === GOOGLE_WEB_CLIENT_ID, `${webId} vs ${GOOGLE_WEB_CLIENT_ID}`);
  const listBlock = /const GOOGLE_APP_CLIENT_IDS = [\s\S]*?\.filter\(Boolean\);/.exec(auth)?.[0] ?? '';
  const amsAppIds = clientIds(listBlock);
  h.check('§2 the AMS lists two app client ids (cardinality floor)', amsAppIds.length === 2, JSON.stringify(amsAppIds));
  h.check('§2 …and the iPhone one is the app\'s', amsAppIds.includes(GOOGLE_IOS_CLIENT_ID), JSON.stringify(amsAppIds));
  h.check('§2 googleLogin checks against googleAudiences()', /audience:\s*googleAudiences\(\)/.test(google));
  h.check('§2 all three ids are one Google project (same number)',
    new Set([GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, ...amsAppIds].map((id) => id.split('-')[0])).size === 1);

  const native = strip(read('./nativeSignIn.ts'));
  h.check('§2 Google is configured with the web and iPhone ids',
    /GoogleSignin\.configure\(\{ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID \}\)/.test(native));
  h.check('§2 the Google choice is forgotten once the token is in hand (the next sign-in asks again)',
    /const token = r\.data\.idToken;\s*GoogleSignin\.signOut\(\)/.test(native));
  h.check('§2 Apple is asked for the email only (no name)',
    /requestedScopes: \[AppleAuthentication\.AppleAuthenticationScope\.EMAIL\]/.test(native) && !/FULL_NAME/.test(native));

  // §3 app.json
  const app = JSON.parse(read('../../app.json')).expo as {
    ios: { bundleIdentifier: string; appleTeamId?: string; usesAppleSignIn?: boolean };
    plugins: (string | [string, Record<string, unknown>])[];
  };
  const plugin = (name: string) => app.plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);
  const g = plugin('@react-native-google-signin/google-signin');
  h.check('§3 the Google plugin is in app.json', Array.isArray(g));
  h.check('§3 …its URL scheme is the iPhone client id reversed',
    Array.isArray(g) && g[1].iosUrlScheme === googleUrlScheme(GOOGLE_IOS_CLIENT_ID), JSON.stringify(g));
  h.check('§3 googleUrlScheme: the known shape', googleUrlScheme('1-ab.apps.googleusercontent.com') === 'com.googleusercontent.apps.1-ab');
  h.check('§3 Sign in with Apple is on (usesAppleSignIn + the plugin)', app.ios.usesAppleSignIn === true && plugin('expo-apple-authentication') !== undefined);
  // Expo refuses to build even for the SIMULATOR when the app carries the
  // Sign in with Apple entitlement and names no team ("No code signing
  // certificates are available to use", 6 Nov 2026). The team is ICSA's Apple
  // Developer team, the one the App ID us.icsa.app was registered under.
  h.check('§3 …and the Apple team is named (team 69B3AATWN8, where us.icsa.app is registered)',
    app.ios.appleTeamId === '69B3AATWN8', String(app.ios.appleTeamId));
  const amsBundle = /const APP_BUNDLE_ID = '([^']+)'/.exec(readAmsFile('server/src/services/appleIdentity.js'))?.[1];
  h.check('§3 the AMS checks Apple\'s token for this app\'s bundle id', !!amsBundle && amsBundle === app.ios.bundleIdentifier, `${amsBundle} vs ${app.ios.bundleIdentifier}`);

  // §4 the screens
  const signIn = strip(read('../app/sign-in.tsx'));
  h.check('§4 the sign-in screen no longer says "a later step"', !/later step/i.test(signIn) && !/NOT_YET/.test(signIn));
  const social = /<View style=\{styles\.social\}>[\s\S]*?\n {12}<\/View>\n/.exec(signIn)?.[0] ?? '';
  h.check('§4 the Google/Apple row extracts (floor)', social.length > 600, String(social.length));
  h.check('§4 Apple\'s own button and Google\'s are in the same row, each flex: 1 (App Review: as prominent)',
    /AppleAuthentication\.AppleAuthenticationButton/.test(social) && /withProvider\('apple'\)/.test(social)
    && /withProvider\('google'\)/.test(social) && (social.match(/styles\.flex/g) ?? []).length === 2);
  h.check('§4 a closed sheet says nothing', /if \(!r\) return;/.test(signIn));
  const me = strip(read('../navigation/MeScreen.tsx'));
  h.check('§4 Me shows the sign-in methods (not in the preview)', /\{!user\.preview \? <SignInMethods email=\{user\.email\} \/> : null\}/.test(me));
  const methods = strip(read('../navigation/SignInMethods.tsx'));
  h.check('§4 Me links and unlinks through the AMS endpoints',
    /'POST', '\/auth\/apple\/link', \{ identity_token: got\.token \}/.test(methods) && /'POST', '\/auth\/apple\/unlink'/.test(methods) && /'GET', '\/auth\/apple'/.test(methods));
  const fw = strip(readAmsFile('server/src/middleware/studentFirewall.js'));
  h.check('§4 …and a student may reach all three (the AMS student firewall)',
    ["{ method: 'GET',  path: '/api/auth/apple' }", "{ method: 'POST', path: '/api/auth/apple/link' }", "{ method: 'POST', path: '/api/auth/apple/unlink' }"].every((e) => fw.includes(e)));
});
