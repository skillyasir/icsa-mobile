import { readFileSync } from 'node:fs';

import { run } from '../../scripts/check-harness.ts';

import { APPEARANCE_CHOICES, APPEARANCE_KEY, DEFAULT_APPEARANCE, overrideFor, parseAppearance } from './appearance.ts';

// Light, with a switch in Me (Yasir, 10 Nov 2026). Everyone starts light; the
// phone keeps the choice; React Native's own override applies it, so every
// useColorScheme() follows — and nothing shows the phone's Dark Mode first.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));

run('appearance.check — light by default, a switch in Me, kept on the phone', (h) => {
  h.check('§0 strip removes comments and keeps strings', strip("a('x') // gone\n/* gone */b").includes("a('x')") && !strip('a // gone').includes('gone'));

  // §1 the rule
  h.check('§1 everyone starts LIGHT (Yasir)', DEFAULT_APPEARANCE === 'light');
  h.check('§1 nothing saved, or nonsense saved: light', [null, undefined, '', 'Dark', 'auto', 42].every((v) => parseAppearance(v) === 'light'));
  h.check('§1 a saved choice is read back as saved', parseAppearance('dark') === 'dark' && parseAppearance('system') === 'system' && parseAppearance('light') === 'light');
  h.check('§1 Light and Dark force themselves; "Same as phone" lifts the override', overrideFor('light') === 'light' && overrideFor('dark') === 'dark' && overrideFor('system') === 'unspecified');
  h.check('§1 Me offers exactly three: Light, Dark, Same as phone', APPEARANCE_CHOICES.map((c) => c.label).join('|') === 'Light|Dark|Same as phone');

  // §2 the provider
  const prov = read('./AppearanceProvider.tsx');
  h.check('§2 the provider extracts (floor)', prov.length > 900, String(prov.length));
  h.check('§2 the default is applied at load, before anything renders', /^Appearance\.setColorScheme\(overrideFor\(DEFAULT_APPEARANCE\)\);$/m.test(prov));
  h.check('§2 the saved choice is read from the phone and applied', /phoneStore\s*\.get\(APPEARANCE_KEY\)/.test(prov) && /Appearance\.setColorScheme\(overrideFor\(c\)\);\s*setChoiceState\(c\);\s*setReady\(true\);/.test(prov));
  h.check('§2 a choice made in Me is applied, then saved on the phone', /Appearance\.setColorScheme\(overrideFor\(c\)\);\s*setChoiceState\(c\);\s*\/?\/?[\s\S]*?await phoneStore\.set\(APPEARANCE_KEY, c\)/.test(prov));
  h.check('§2 the key is the one place it is named', APPEARANCE_KEY === 'icsa.appearance');

  // §3 the splash waits for it, so a Dark phone never flashes light (or the reverse)
  const layout = read('../app/_layout.tsx');
  h.check('§3 the provider wraps the whole app', /<AppearanceProvider>\s*<Root \/>\s*<\/AppearanceProvider>/.test(layout));
  h.check('§3 the splash hides only when the fonts AND the choice are ready', /if \(fontsDone && appearance\.ready\) SplashScreen\.hideAsync\(\);/.test(layout) && /if \(!fontsDone \|\| !appearance\.ready\) return null;/.test(layout));

  // §4 the switch in Me, for everyone (the preview too — it needs no AMS)
  const me = read('../navigation/MeScreen.tsx');
  const block = /APPEARANCE\s*<\/AppText>[\s\S]*?<\/Card>/.exec(me)?.[0] ?? '';
  h.check('§4 Me has an APPEARANCE section (floor)', block.length > 400, String(block.length));
  h.check('§4 …drawn from APPEARANCE_CHOICES, each a radio that sets the choice', /APPEARANCE_CHOICES\.map\(/.test(block) && /accessibilityRole="radio"/.test(block) && /appearance\.setChoice\(c\.value\)/.test(block) && /checked: on/.test(block));
  const at = me.indexOf('APPEARANCE\n');
  const lead = at > 0 ? me.slice(Math.max(0, at - 200), at) : '';
  h.check('§4 …for everyone: not inside the preview or sign-in conditions', at > 0 && lead.length === 200 && !/user\.preview/.test(lead), lead.slice(-80));

  // §5 signing out keeps it: it is the phone's choice, not the person's
  const session = read('../session/SessionContext.tsx');
  h.check('§5 signing out never forgets the appearance', !/APPEARANCE_KEY|icsa\.appearance/.test(session) && !/APPEARANCE_KEY/.test(read('../lock/LockProvider.tsx')));

  // §6 the theme still asks React Native, which the override answers
  h.check('§6 useAppTheme reads useColorScheme (so the override reaches every screen)', /useColorScheme\(\) === 'dark'/.test(read('./useAppTheme.ts')));
});
