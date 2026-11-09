// Colour arithmetic for vibrant cards (9 Nov 2026, Yasir: "course cards need
// to be vibrant"). Pure — no React Native — so color.check.ts can hold it.
//
// A card is tinted with its subject's colour, and every text colour on it is
// still chosen for contrast: the tint is MIXED into the surface (an opaque
// colour, so contrast can be measured), and a solid colour's text is whichever
// of the theme's ink or white reads better on it.

const HEX = /^#[0-9a-f]{6}$/i;

export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** `base` with `amount` (0–1) of `over` laid on it — an opaque colour. */
export function mix(base: string, over: string, amount: number): string {
  const a = rgb(base);
  const b = rgb(over);
  const w = Math.max(0, Math.min(1, amount));
  return `#${toHex(a[0] + (b[0] - a[0]) * w)}${toHex(a[1] + (b[1] - a[1]) * w)}${toHex(a[2] + (b[2] - a[2]) * w)}`.toUpperCase();
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const INK = '#0F172A';
export const WHITE = '#FFFFFF';

/** The text colour for a solid background: ink or white, whichever reads better. */
export function readableOn(bg: string): string {
  return contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK;
}

/**
 * `surface` tinted with up to `amount` of `colour`, backing off the tint until
 * every one of `inks` reads at least 4.5:1 on it. A pale subject colour (white,
 * yellow) on the dark theme would otherwise wash the card out under its text.
 */
export function tintedCard(surface: string, colour: string, amount: number, inks: string[]): string {
  for (let a = amount; a > 0; a -= 0.02) {
    const card = mix(surface, colour, a);
    if (inks.every((ink) => contrast(ink, card) >= 4.5)) return card;
  }
  return mix(surface, surface, 0);
}
