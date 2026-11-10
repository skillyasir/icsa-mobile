// The iPad layout (Yasir ruled, 10 Nov 2026: "Full iPad layout first";
// designs approved the same day on the mockups canvas, row "iPad").
//
// Phones keep the phone layout and the bottom tabs (Yasir, 10 Nov 2026: "Keep
// tabs on phones"). The app is portrait-only on phones, so a phone is never
// wider than about 440 pt; anything 700 pt or wider is an iPad (or a large
// Android tablet). Pure — layout.check.ts holds it.

/** An iPad in either orientation: the sidebar, wider margins, dashboards in columns. */
export const WIDE_MIN = 700;

/** Room for a list with its open item beside it (iPad 13" either way, 11" landscape). */
export const SPLIT_MIN = 1000;

/** A single-column screen on a wide display is centred at this width, never stretched. */
export const COLUMN_MAX = 760;

/** The list's width when its open item is beside it. */
export const LIST_PANE = 420;

export type Layout = { wide: boolean; split: boolean };

export function layoutFor(width: number): Layout {
  const w = Number.isFinite(width) ? width : 0;
  return { wide: w >= WIDE_MIN, split: w >= SPLIT_MIN };
}
