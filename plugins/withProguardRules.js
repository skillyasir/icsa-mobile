// plugins/withProguardRules.js — keep rules the Android release build needs
// that no library ships correctly.
//
// android/ is generated (`npx expo prebuild`), so the rules are added to
// android/app/proguard-rules.pro here, on every prebuild, never by hand.
//
// Why (12 Nov 2026): the Play closed-test build crashed on every start, on
// every phone. react-native-maps brings in WorkManager (work-runtime 2.9.1),
// whose database Room creates by reflection: it looks up WorkDatabase_Impl by
// name and calls its no-argument constructor. Room 2.5.0's own rule keeps the
// class but not that constructor, R8 (full mode, shrinking on in release)
// removed it, and the app died before its first screen with "Failed to create
// an instance of class androidx.work.impl.WorkDatabase". The debug build does
// not shrink, so it never showed.
//
// scripts/release.check.ts runs addProguardRules on the real Expo 58 file and
// reads the last release build's R8 report for the constructor.

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARK = '# ICSA (plugins/withProguardRules.js)';

const RULES = [
  MARK,
  "# Room creates every database by reflection through its no-argument constructor;",
  "# keep it (WorkManager's database, from react-native-maps — 12 Nov 2026).",
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
].join('\n');

/** proguard-rules.pro with ICSA's rules appended once. */
function addProguardRules(src) {
  if (src.includes(MARK)) return src;
  return `${src.replace(/\s*$/, '')}\n\n${RULES}\n`;
}

const withProguardRules = (config) =>
  withDangerousMod(config, [
    'android',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      // No file is a template this plugin does not know: stop, never skip.
      const src = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, addProguardRules(src));
      return c;
    },
  ]);

module.exports = withProguardRules;
module.exports.addProguardRules = addProguardRules;
module.exports.MARK = MARK;
