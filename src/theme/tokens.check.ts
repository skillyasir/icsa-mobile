import { run } from '../../scripts/check-harness.ts';

import { palettes, type Palette } from './tokens.ts';

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every text-on-surface pair the components draw. 4.5:1 is the WCAG AA bar
// for body text; the app uses it for all text, labels included.
const PAIRS: [keyof Palette, keyof Palette][] = [
  ['text', 'background'], ['text', 'surface'], ['text', 'surfaceMuted'],
  ['textMuted', 'background'], ['textMuted', 'surface'], ['textMuted', 'surfaceMuted'],
  ['textSubtle', 'background'], ['textSubtle', 'surface'], ['textSubtle', 'surfaceMuted'],
  ['link', 'background'], ['link', 'surface'],
  ['onPrimary', 'primary'], ['onPrimary', 'primaryPressed'],
  ['onSuccessSoft', 'successSoft'], ['onWarningSoft', 'warningSoft'],
  ['onDangerSoft', 'dangerSoft'], ['onDangerSoft', 'surface'], ['onInfoSoft', 'infoSoft'],
  ['onHero', 'hero'], ['onHeroMuted', 'hero'], ['onAppleButton', 'appleButton'],
  ['onAttention', 'attention'], ['onAttention', 'attentionPressed'],
];

run('tokens.check — every text colour is readable', (h) => {
  // §1 the measurement itself, against known values
  h.check('§1 black on white is 21:1', Math.abs(contrast('#000000', '#FFFFFF') - 21) < 0.01);
  h.check('§1 a colour on itself is 1:1', Math.abs(contrast('#0D47A1', '#0D47A1') - 1) < 0.001);
  h.check('§1 #767676 on white is the 4.5 boundary', Math.abs(contrast('#767676', '#FFFFFF') - 4.54) < 0.01);

  // §2 the pairs, in both schemes
  h.check('§2 the pair list is not empty', PAIRS.length >= 20);
  for (const scheme of ['light', 'dark'] as const) {
    const p = palettes[scheme];
    for (const [fg, bg] of PAIRS) {
      const r = contrast(p[fg], p[bg]);
      h.check(`§2 ${scheme}: ${fg} on ${bg} ≥ 4.5 (${r.toFixed(2)})`, r >= 4.5, `${p[fg]} on ${p[bg]}`);
    }
  }

  // §3 both schemes define every key with a real colour
  const keys = Object.keys(palettes.light) as (keyof Palette)[];
  h.check('§3 light and dark have the same keys', keys.length > 20 && keys.every((k) => k in palettes.dark));
  h.check(
    '§3 every value is #rrggbb',
    [palettes.light, palettes.dark].every((p) => keys.every((k) => /^#[0-9a-f]{6}$/i.test(p[k]))),
  );
});
