// plugins/withReleaseSigning.js — sign the Android release build with ICSA's
// own upload key (Yasir ruled, 8 Nov 2026: build on the Mac, not in Expo's
// cloud).
//
// android/ is generated (`npx expo prebuild`), so the signing is added here,
// on every prebuild, never by hand. Expo's template signs a RELEASE build with
// the public debug key; this plugin replaces that with a `release` signing
// config whose four values come from ~/.gradle/gradle.properties on the Mac
// that builds:
//
//   ICSA_UPLOAD_STORE_FILE=/Users/mac/icsa-keys/icsa-upload.keystore
//   ICSA_UPLOAD_KEY_ALIAS=icsa-upload
//   ICSA_UPLOAD_STORE_PASSWORD=…
//   ICSA_UPLOAD_KEY_PASSWORD=…
//
// The key and its passwords never enter this repo. A release build without
// them STOPS with a message — it never falls back to the debug key. A debug
// build (`npx expo run:android`) is untouched.
//
// scripts/release.check.ts runs addReleaseSigning on the real Expo 58
// template and holds all of this.

const { withAppBuildGradle } = require('expo/config-plugins');

const MARK = '// ICSA release signing (plugins/withReleaseSigning.js)';

const DEBUG_END = "            keyPassword 'android'\n        }\n    }";
const RELEASE_CONFIG = [
  "            keyPassword 'android'",
  '        }',
  '        release {',
  `            ${MARK}`,
  "            if (findProperty('ICSA_UPLOAD_STORE_FILE')) {",
  "                storeFile file(findProperty('ICSA_UPLOAD_STORE_FILE'))",
  "                storePassword findProperty('ICSA_UPLOAD_STORE_PASSWORD')",
  "                keyAlias findProperty('ICSA_UPLOAD_KEY_ALIAS')",
  "                keyPassword findProperty('ICSA_UPLOAD_KEY_PASSWORD')",
  '            }',
  '        }',
  '    }',
].join('\n');

const RELEASE_USES_DEBUG = [
  '            // Caution! In production, you need to generate your own keystore file.',
  '            // see https://reactnative.dev/docs/signed-apk-android.',
  '            signingConfig signingConfigs.debug',
].join('\n');
const RELEASE_USES_RELEASE = '            signingConfig signingConfigs.release';

const STOP = [
  '',
  `${MARK}: a release build without the upload key stops here —`,
  '// it never signs with the debug key.',
  'gradle.taskGraph.whenReady { graph ->',
  "    def release = graph.allTasks.any { t -> (t.name.startsWith('bundle') || t.name.startsWith('assemble')) && t.name.toLowerCase().contains('release') }",
  "    def missing = ['ICSA_UPLOAD_STORE_FILE', 'ICSA_UPLOAD_STORE_PASSWORD', 'ICSA_UPLOAD_KEY_ALIAS', 'ICSA_UPLOAD_KEY_PASSWORD'].findAll { !project.findProperty(it) }",
  '    if (release && !missing.isEmpty()) {',
  '        throw new GradleException("ICSA: no upload key — set " + missing.join(", ") + " in ~/.gradle/gradle.properties")',
  '    }',
  '}',
  '',
].join('\n');

/** The release signing added to an app/build.gradle. Throws on a shape it does not know. */
function addReleaseSigning(src) {
  if (src.includes(MARK)) return src;
  const count = (s) => src.split(s).length - 1;
  if (count(DEBUG_END) !== 1 || count(RELEASE_USES_DEBUG) !== 1) {
    throw new Error(
      'withReleaseSigning: android/app/build.gradle is not the Expo template shape this plugin knows ' +
        `(debug signing end: ${count(DEBUG_END)}, release using debug: ${count(RELEASE_USES_DEBUG)}). ` +
        'Read the new template and update the plugin — never sign by hand.',
    );
  }
  return src.replace(DEBUG_END, RELEASE_CONFIG).replace(RELEASE_USES_DEBUG, RELEASE_USES_RELEASE) + STOP;
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') throw new Error('withReleaseSigning: app/build.gradle is not Groovy');
    c.modResults.contents = addReleaseSigning(c.modResults.contents);
    return c;
  });

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
module.exports.MARK = MARK;
