import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { run } from './check-harness.ts';

// The Android release build (Yasir ruled, 8 Nov 2026: built and signed on the
// Mac with ICSA's own upload key). plugins/withReleaseSigning.js is RUN here on
// the real Expo 58 template (scripts/fixtures/expo58-app-build.gradle, copied
// from the Mac's prebuild on 8 Nov 2026) — and on the Mac's own
// android/app/build.gradle when there is one — and app.json is held to what
// the Play closed test needs.

const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url);
const plugin = require('../plugins/withReleaseSigning.js') as { addReleaseSigning: (s: string) => string; MARK: string };

const KEYS = ['ICSA_UPLOAD_STORE_FILE', 'ICSA_UPLOAD_STORE_PASSWORD', 'ICSA_UPLOAD_KEY_ALIAS', 'ICSA_UPLOAD_KEY_PASSWORD'];

/** The block that follows `name {` — braces counted, so a nested block is kept whole. */
function block(src: string, name: string, from = 0): string {
  const at = src.indexOf(`${name} {`, from);
  if (at < 0) return '';
  let depth = 0;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(at, i + 1);
  }
  return '';
}
const tryAdd = (s: string) => {
  try {
    return plugin.addReleaseSigning(s);
  } catch (err) {
    return `THREW: ${err instanceof Error ? err.message : String(err)}`;
  }
};

/** What a correctly signed build.gradle must say — the same questions for the fixture and the Mac's own file. */
function holds(h: { check: (label: string, cond: boolean, detail?: string) => void }, where: string, out: string) {
  const signing = block(out, 'signingConfigs');
  const types = block(out, 'buildTypes');
  const release = block(types, 'release');
  const debugType = block(types, 'debug');
  h.check(`${where}: signingConfigs and buildTypes extract`, signing.length > 150 && types.length > 300 && release.length > 200 && debugType.length > 20, `${signing.length}/${types.length}/${release.length}`);
  const rel = block(signing, 'release');
  h.check(`${where}: a release signing config, its four values from Gradle properties`, KEYS.every((k) => rel.includes(`findProperty('${k}')`)) && /storeFile file\(findProperty\('ICSA_UPLOAD_STORE_FILE'\)\)/.test(rel));
  h.check(`${where}: …no password is written in the file`, !/storePassword '[^']+'|keyPassword '[^']+'/.test(rel));
  h.check(`${where}: the RELEASE build is signed by it`, /signingConfig signingConfigs\.release\b/.test(release) && !/signingConfigs\.debug/.test(release));
  h.check(`${where}: the DEBUG build is untouched`, /signingConfig signingConfigs\.debug\b/.test(debugType) && /storeFile file\('debug\.keystore'\)/.test(block(signing, 'debug')));
  const stop = out.slice(out.lastIndexOf(plugin.MARK));
  h.check(`${where}: a release build without the key STOPS (never the debug key)`, /gradle\.taskGraph\.whenReady/.test(stop) && /throw new GradleException/.test(stop) && KEYS.every((k) => stop.includes(`'${k}'`)));
  h.check(`${where}: …and only a release build (bundle/assemble …Release)`, /t\.name\.startsWith\('bundle'\) \|\| t\.name\.startsWith\('assemble'\)/.test(stop) && /contains\('release'\)/.test(stop));
}

run('release.check — the Android release build is signed with ICSA\'s upload key', (h) => {
  const fixture = readFileSync(new URL('fixtures/expo58-app-build.gradle', import.meta.url), 'utf8');
  h.check('§0 the fixture is the real Expo 58 template, read whole', fixture.length > 7000 && /signingConfig signingConfigs\.debug/.test(fixture) && /namespace 'us\.icsa\.app'/.test(fixture), String(fixture.length));
  h.check('§0 block() keeps a nested block whole', block('a { b { c } d }', 'a') === 'a { b { c } d }' && block('x', 'a') === '');
  h.check('§0 the fixture is unsigned before the plugin (the template signs release with the DEBUG key)', /release \{[\s\S]*?signingConfig signingConfigs\.debug/.test(block(fixture, 'buildTypes')));

  // §1 the plugin on the real template
  const once = tryAdd(fixture);
  h.check('§1 the plugin applies to the template', !once.startsWith('THREW'), once.slice(0, 120));
  holds(h, '§1 template', once);
  h.check('§1 running it twice changes nothing (every prebuild runs it)', tryAdd(once) === once);
  const head = fixture.slice(0, fixture.indexOf('    signingConfigs {'));
  const tail = fixture.slice(fixture.indexOf('    packagingOptions {'));
  h.check('§1 nothing else in the file moved (everything before signingConfigs and after buildTypes is as it was)', head.length > 2000 && tail.length > 2000 && once.startsWith(head) && once.includes(tail), `${head.length}/${tail.length}`);
  const unknown = tryAdd(fixture.replace('signingConfig signingConfigs.debug\n            def enableShrink', 'signingConfig signingConfigs.other\n            def enableShrink'));
  h.check('§1 a template shape it does not know STOPS prebuild (never signs by guess)', unknown.startsWith('THREW: withReleaseSigning'), unknown.slice(0, 100));

  // §2 the Mac's own android/, when it has been prebuilt
  const real = new URL('android/app/build.gradle', ROOT);
  if (existsSync(real)) {
    const src = readFileSync(real, 'utf8');
    const out = src.includes(plugin.MARK) ? src : tryAdd(src);
    h.check('§2 this machine\'s android/app/build.gradle: the plugin applies', !out.startsWith('THREW'), out.slice(0, 120));
    holds(h, '§2 this machine', out);
  } else {
    h.check('§2 no android/ here (not prebuilt) — the template fixture stands for it', true);
  }

  // §3 app.json for the closed test
  const app = JSON.parse(readFileSync(new URL('app.json', ROOT), 'utf8')) as { expo: { android: { versionCode?: number; blockedPermissions?: string[]; package?: string }; plugins: unknown[] } };
  const a = app.expo.android;
  h.check('§3 the plugin is in app.json', app.expo.plugins.includes('./plugins/withReleaseSigning'));
  h.check('§3 versionCode is a whole number from 1 (raise it for every upload)', Number.isInteger(a.versionCode) && (a.versionCode ?? 0) >= 1, String(a.versionCode));
  h.check('§3 the package is us.icsa.app', a.package === 'us.icsa.app');
  h.check('§3 SYSTEM_ALERT_WINDOW is removed (the app never draws over other apps)', (a.blockedPermissions ?? []).includes('android.permission.SYSTEM_ALERT_WINDOW'));
  const picker = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined;
  h.check('§3 the photo and camera words name what they are for — proofs AND assignments', !!picker && /payment proof or your assignment/.test(String(picker[1].photosPermission)) && /payment proof or your assignment/.test(String(picker[1].cameraPermission)) && picker[1].microphonePermission === false);
  const loc = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location') as [string, Record<string, unknown>] | undefined;
  h.check('§3 no background location (none of the declarations Play asks for it)', !!loc && loc[1].isAndroidBackgroundLocationEnabled === false && loc[1].locationAlwaysPermission === false);

  // §4 the key never enters the repo
  const ignore = readFileSync(new URL('.gitignore', ROOT), 'utf8').split('\n');
  h.check('§4 git ignores keystores and android/', ignore.includes('*.keystore') && ignore.includes('*.jks') && ignore.includes('android/'));
});
