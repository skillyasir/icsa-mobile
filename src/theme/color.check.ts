import { run } from '../../scripts/check-harness.ts';

import { INK, WHITE, contrast, isHex, luminance, mix, readableOn, tintedCard } from './color.ts';

// The colour arithmetic behind the vibrant subject cards (9 Nov 2026). Every
// figure here has a known answer, so a wrong formula cannot pass quietly.

run('color.check — mix, luminance, contrast, readable text', (h) => {
  h.check('§1 isHex: #RRGGBB yes; short, named, empty, null no',
    isHex('#0d47a1') && isHex('#FFFFFF') && !isHex('#fff') && !isHex('blue') && !isHex('') && !isHex(null));
  h.check('§1 mix: amount 0 is the base, 1 is the overlay', mix('#000000', '#FFFFFF', 0) === '#000000' && mix('#000000', '#FFFFFF', 1) === '#FFFFFF');
  h.check('§1 mix: half of black and white is mid-grey', mix('#000000', '#FFFFFF', 0.5) === '#808080', mix('#000000', '#FFFFFF', 0.5));
  h.check('§1 mix: an amount past 0–1 is held to the ends', mix('#000000', '#FFFFFF', 2) === '#FFFFFF' && mix('#000000', '#FFFFFF', -1) === '#000000');
  h.check('§2 luminance: white 1, black 0', luminance('#FFFFFF') === 1 && luminance('#000000') === 0);
  h.check('§2 contrast: white on black is 21:1, either way round', Math.abs(contrast('#FFFFFF', '#000000') - 21) < 1e-9 && contrast('#000000', '#FFFFFF') === contrast('#FFFFFF', '#000000'));
  h.check('§2 contrast: a colour on itself is 1:1', contrast('#0D47A1', '#0D47A1') === 1);
  h.check('§2 contrast: the brand blue on white is about 8.6:1 (published figure)', Math.abs(contrast('#0D47A1', '#FFFFFF') - 8.6) < 0.1, contrast('#0D47A1', '#FFFFFF').toFixed(2));
  h.check('§3 readableOn: white on black, ink on white', readableOn('#000000') === WHITE && readableOn('#FFFFFF') === INK);
  h.check('§3 readableOn: ink on the brand yellow, white on the brand blue', readableOn('#FFC107') === INK && readableOn('#0D47A1') === WHITE);
  const dark = '#121B2E';
  h.check('§4 tintedCard: a strong tint that keeps contrast is kept as asked', tintedCard(dark, '#2563EB', 0.2, ['#F1F5F9']) === mix(dark, '#2563EB', 0.2));
  const washed = tintedCard(dark, '#FFFFFF', 0.6, ['#FCA5A5']);
  h.check('§4 tintedCard: white at 60% on dark is backed off until the pink ink reads 4.5:1', washed !== mix(dark, '#FFFFFF', 0.6) && contrast('#FCA5A5', washed) >= 4.5, `${washed} ${contrast('#FCA5A5', washed).toFixed(2)}`);
  h.check('§4 tintedCard: an ink that fails on the bare surface gets the bare surface back', tintedCard('#FFFFFF', '#000000', 0.5, ['#FFFFFF']) === '#FFFFFF');
});
