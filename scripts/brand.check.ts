import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { run } from './check-harness.ts';

// The ICSA app's icons, launch mark and Play graphics (Yasir ruled, 8 Nov
// 2026: icon C — emblem-style ICSA letters and the yellow bar on ICSA blue;
// made by scripts/make-icons.py). Found 8 Nov 2026 while preparing the first
// Play upload: the app still carried EXPO'S SAMPLE icon and launch mark, and a
// signed build with them had already been made. This holds the sizes and kinds
// each store requires, the wiring in app.json, and that no template art comes
// back.

const ROOT = new URL('../', import.meta.url);

/** Width, height and PNG colour type (2 = RGB, 6 = RGBA), read from the IHDR chunk. */
function png(rel: string): { w: number; h: number; type: number; md5: string } | null {
  const p = new URL(rel, ROOT);
  if (!existsSync(p)) return null;
  const b = readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: b[25], md5: createHash('md5').update(b).digest('hex') };
}

/** Expo's SDK 58 template art, as it was in this repo until 8 Nov 2026. */
const EXPO_TEMPLATE = new Set(['8d892ef03dbd43e8d899c1d605ad42df', '72e71a9c846c6aa4ae32476641a00e18', '5ee5db91d59518c45ebcc99a2f5afc57']);

run('brand.check — the app wears ICSA\'s icon, never Expo\'s', (h) => {
  const probe = png('assets/images/icon.png');
  h.check('§0 png() reads a real PNG header', !!probe && probe.w > 0 && probe.h > 0, JSON.stringify(probe));

  const want: [string, number, number, number[], string][] = [
    ['assets/images/icon.png', 1024, 1024, [2], 'the master and iPhone icon: 1024, no transparency (the App Store refuses alpha)'],
    ['assets/images/android-icon-foreground.png', 512, 512, [6], 'Android adaptive foreground: transparent'],
    ['assets/images/android-icon-background.png', 512, 512, [2, 6], 'Android adaptive background'],
    ['assets/images/android-icon-monochrome.png', 432, 432, [6], 'Android themed icon: transparent'],
    ['assets/images/splash-icon.png', 456, 300, [6], 'the launch mark: transparent, drawn on ICSA blue'],
    ['store/play-icon-512.png', 512, 512, [2, 6], 'Play listing icon: 512 x 512'],
    ['store/play-feature-graphic.png', 1024, 500, [2], 'Play feature graphic: 1024 x 500, no transparency'],
  ];
  for (const [rel, w, ht, types, what] of want) {
    const p = png(rel);
    h.check(`§1 ${what}`, !!p && p.w === w && p.h === ht && types.includes(p.type), p ? `${p.w}x${p.h} type ${p.type}` : 'missing');
    h.check(`§1 …and it is not Expo's template art (${rel})`, !!p && !EXPO_TEMPLATE.has(p.md5));
  }

  const app = JSON.parse(readFileSync(new URL('app.json', ROOT), 'utf8')) as {
    expo: { icon: string; ios: { icon?: string }; android: { adaptiveIcon: Record<string, string> }; plugins: unknown[] };
  };
  const e = app.expo;
  h.check('§2 the app icon is ICSA\'s, on iPhone too', e.icon === './assets/images/icon.png' && e.ios.icon === './assets/images/icon.png');
  h.check('§2 Android\'s adaptive icon is ICSA blue behind ICSA\'s mark', e.android.adaptiveIcon.backgroundColor === '#0D47A1' && e.android.adaptiveIcon.foregroundImage === './assets/images/android-icon-foreground.png' && e.android.adaptiveIcon.monochromeImage === './assets/images/android-icon-monochrome.png');
  const splash = e.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, Record<string, unknown>] | undefined;
  h.check('§2 the launch screen: the ICSA mark on ICSA blue', !!splash && splash[1].image === './assets/images/splash-icon.png' && splash[1].backgroundColor === '#0D47A1' && Number(splash[1].imageWidth) >= 120);
  h.check('§2 nothing still points at Expo\'s icon bundle', !JSON.stringify(app).includes('expo.icon') && !existsSync(new URL('assets/expo.icon', ROOT)));
  h.check('§3 the letters\' font travels with its licence', existsSync(new URL('assets/brand/Anton-latin-400.woff', ROOT)) && /SIL Open Font License/.test(readFileSync(new URL('assets/brand/Anton-OFL.txt', ROOT), 'utf8')));
});
