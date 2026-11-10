// Light, dark, or the phone's own setting (Yasir, 10 Nov 2026: "Light, with a
// switch in Me"). Until then the app followed the phone, so a phone in Dark
// Mode showed ICSA dark. Now everyone starts LIGHT; anyone can choose Dark or
// "Same as phone" in Me › Appearance. The choice belongs to the phone, not to
// the person: signing out keeps it. Pure — appearance.check.ts holds it.

export type AppearanceChoice = 'light' | 'dark' | 'system';

export const APPEARANCE_KEY = 'icsa.appearance';

export const DEFAULT_APPEARANCE: AppearanceChoice = 'light';

export const APPEARANCE_CHOICES: readonly { value: AppearanceChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Same as phone' },
];

/** What was saved on the phone, or the default when nothing (or nonsense) was. */
export function parseAppearance(saved: unknown): AppearanceChoice {
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_APPEARANCE;
}

/** The value React Native's Appearance.setColorScheme takes for a choice. */
export function overrideFor(choice: AppearanceChoice): 'light' | 'dark' | 'unspecified' {
  return choice === 'system' ? 'unspecified' : choice;
}
