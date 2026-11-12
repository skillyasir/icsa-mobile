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

/** The members R8's usage.txt says it removed from one class, over every block for it; a bare class line = the whole class went. */
function removedMembers(usage: string, cls: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of usage.split('\n')) {
    const header = !/^\s/.test(line);
    if (header) inside = line === `${cls}:`;
    if (header && line === cls) out.push('the whole class');
    else if (inside && !header && line.trim()) out.push(line.trim());
  }
  return out;
}

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
  // iPhone (9 Nov 2026): App Store Connect refuses a second upload with the
  // same build number, so it is set here and raised for every upload.
  const ios = (JSON.parse(readFileSync(new URL('app.json', ROOT), 'utf8')) as { expo: { ios: { buildNumber?: string } } }).expo.ios;
  h.check('§3 the iOS buildNumber is a whole number from 1, written as text (raise it for every upload)', typeof ios.buildNumber === 'string' && /^[1-9]\d*$/.test(ios.buildNumber), String(ios.buildNumber));
  // Every test build is 1.0.0, so Me also shows the build (10 Nov 2026).
  const client = readFileSync(new URL('src/api/client.ts', ROOT), 'utf8');
  const me = readFileSync(new URL('src/navigation/MeScreen.tsx', ROOT), 'utf8');
  h.check('§3 Me shows the build beside the version (iPhone buildNumber, Android versionCode)',
    /expoConfig\?\.ios\?\.buildNumber/.test(client) && /expoConfig\?\.android\?\.versionCode/.test(client) && /\(build \$\{APP_BUILD\}\)/.test(me));
  h.check('§3 the package is us.icsa.app', a.package === 'us.icsa.app');
  h.check('§3 SYSTEM_ALERT_WINDOW is removed (the app never draws over other apps)', (a.blockedPermissions ?? []).includes('android.permission.SYSTEM_ALERT_WINDOW'));
  const picker = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker') as [string, Record<string, unknown>] | undefined;
  h.check('§3 the photo and camera words name what they are for — proofs AND assignments', !!picker && /payment proof or your assignment/.test(String(picker[1].photosPermission)) && /payment proof or your assignment/.test(String(picker[1].cameraPermission)) && picker[1].microphonePermission === false);
  const loc = app.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-location') as [string, Record<string, unknown>] | undefined;
  h.check('§3 no background location (none of the declarations Play asks for it)', !!loc && loc[1].isAndroidBackgroundLocationEnabled === false && loc[1].locationAlwaysPermission === false);

  // §4 the key never enters the repo
  const ignore = readFileSync(new URL('.gitignore', ROOT), 'utf8').split('\n');
  h.check('§4 git ignores keystores and android/', ignore.includes('*.keystore') && ignore.includes('*.jks') && ignore.includes('android/'));

  // §5 the keep rules shrinking needs. 12 Nov 2026: the Play build crashed on
  // every start — R8 removed the no-argument constructor Room calls by
  // reflection to create WorkManager's database (react-native-maps brings it).
  const rules = require('../plugins/withProguardRules.js') as { addProguardRules: (s: string) => string; MARK: string };
  const KEEP = /^-keep class \* extends androidx\.room\.RoomDatabase \{ <init>\(\); \}$/m;
  h.check('§5 the matcher finds the rule as its own line — not a comment mentioning it, not the class-only form',
    KEEP.test('x\n-keep class * extends androidx.room.RoomDatabase { <init>(); }\n') &&
    !KEEP.test('# -keep class * extends androidx.room.RoomDatabase { <init>(); }') &&
    !KEEP.test('-keep class * extends androidx.room.RoomDatabase\n'));
  h.check('§5 removedMembers reads every usage.txt block for the class, and only it',
    JSON.stringify(removedMembers('a.B:\n    public void <init>()\nandroidx.work.impl.WorkDatabase_Impl:\n    public void <init>()\n    x\nc.D\nandroidx.work.impl.WorkDatabase_Impl:\n    y\n', 'androidx.work.impl.WorkDatabase_Impl')) === JSON.stringify(['public void <init>()', 'x', 'y']) &&
    removedMembers('androidx.work.impl.WorkDatabase_Impl\n', 'androidx.work.impl.WorkDatabase_Impl')[0] === 'the whole class' &&
    removedMembers('a.B:\n    x\n', 'androidx.work.impl.WorkDatabase_Impl').length === 0);
  const pro = readFileSync(new URL('fixtures/expo58-proguard-rules.pro', import.meta.url), 'utf8');
  h.check('§5 the fixture is the real Expo 58 proguard-rules.pro, without the rule', pro.length > 300 && /reanimated/.test(pro) && !KEEP.test(pro), String(pro.length));
  const added = rules.addProguardRules(pro);
  h.check('§5 the plugin adds the rule', KEEP.test(added));
  h.check('§5 …keeps everything that was there, and running it twice changes nothing', added.startsWith(pro.replace(/\s*$/, '')) && rules.addProguardRules(added) === added);
  h.check('§5 the plugin is in app.json', app.expo.plugins.includes('./plugins/withProguardRules'));
  const realPro = new URL('android/app/proguard-rules.pro', ROOT);
  if (existsSync(realPro)) {
    h.check("§5 this machine's android/app/proguard-rules.pro: the plugin applies", KEEP.test(rules.addProguardRules(readFileSync(realPro, 'utf8'))));
  }
  // The last release build's own R8 report — the build itself, not the rule.
  const usageUrl = new URL('android/app/build/outputs/mapping/release/usage.txt', ROOT);
  if (existsSync(usageUrl)) {
    const usage = readFileSync(usageUrl, 'utf8');
    const removed = removedMembers(usage, 'androidx.work.impl.WorkDatabase_Impl');
    h.check('§5 the last release build\'s R8 report is read whole', usage.length > 100000, String(usage.length));
    h.check('§5 the last release build kept WorkDatabase_Impl and its constructor (red = that build predates the rule: prebuild and rebuild)',
      !removed.some((m) => m === 'the whole class' || /\s<init>\(\)$/.test(m)), removed.join(' | '));
  }
});
