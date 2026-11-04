// ICSA design tokens — the one place the app's colours, type and spacing live.
//
// Brand (ICSA, confirmed 3 Nov 2026): blue #0D47A1, green #16A34A,
// yellow #FFC107, white, the Nunito family. Blue is for action, green for
// success / present, yellow for attention, red only for real problems.
//
// Every text colour below was chosen to pass 4.5:1 against the surface it sits
// on, in both schemes. Change a colour here, never in a screen.

export const brand = {
  blue: '#0D47A1',
  green: '#16A34A',
  yellow: '#FFC107',
  white: '#FFFFFF',
} as const;

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  link: string;
  successSoft: string;
  onSuccessSoft: string;
  warningSoft: string;
  onWarningSoft: string;
  dangerSoft: string;
  onDangerSoft: string;
  infoSoft: string;
  onInfoSoft: string;
  hero: string;
  onHero: string;
  onHeroMuted: string;
  appleButton: string;
  onAppleButton: string;
};

export const palettes: Record<ColorScheme, Palette> = {
  light: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#F8FAFC',
    text: '#0F172A',
    textMuted: '#334155',
    textSubtle: '#5B6B82',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    primary: brand.blue,
    primaryPressed: '#0A3A85',
    onPrimary: '#FFFFFF',
    link: brand.blue,
    successSoft: '#DCFCE7',
    onSuccessSoft: '#166534',
    warningSoft: '#FEF3C7',
    onWarningSoft: '#854D0E',
    dangerSoft: '#FEE2E2',
    onDangerSoft: '#991B1B',
    infoSoft: '#E8F0FD',
    onInfoSoft: '#0A3A85',
    hero: brand.blue,
    onHero: '#FFFFFF',
    onHeroMuted: '#DCE7FA',
    appleButton: '#000000',
    onAppleButton: '#FFFFFF',
  },
  dark: {
    background: '#0B1220',
    surface: '#121B2E',
    surfaceMuted: '#18233A',
    text: '#F1F5F9',
    textMuted: '#CBD5E1',
    textSubtle: '#A3B1C6',
    border: '#24324D',
    borderStrong: '#3A4A66',
    primary: '#1E5BC6',
    primaryPressed: '#184CA8',
    onPrimary: '#FFFFFF',
    link: '#9DBDFF',
    successSoft: '#123A24',
    onSuccessSoft: '#86EFAC',
    warningSoft: '#3D2E0A',
    onWarningSoft: '#FDE68A',
    dangerSoft: '#3F1418',
    onDangerSoft: '#FCA5A5',
    infoSoft: '#162B52',
    onInfoSoft: '#BFD3F5',
    hero: '#0D47A1',
    onHero: '#FFFFFF',
    onHeroMuted: '#DCE7FA',
    appleButton: '#FFFFFF',
    onAppleButton: '#000000',
  },
};

// Nunito weights loaded at start-up (src/app/_layout.tsx). On Android a custom
// font ignores fontWeight, so every weight is its own family — use these
// names, never fontWeight.
export const font = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

export const type = {
  largeTitle: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: font.extrabold, fontSize: 22, lineHeight: 28 },
  headline: { fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: font.extrabold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: font.extrabold, fontSize: 16, lineHeight: 20 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 10, md: 14, lg: 16, xl: 22, pill: 999 } as const;

// Apple's minimum comfortable touch target (44 pt); Android's 48 dp is met by
// the 50-high buttons and the row padding.
export const minTouch = 44;
