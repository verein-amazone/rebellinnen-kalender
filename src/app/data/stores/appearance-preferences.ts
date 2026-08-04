/**
 * Persisted appearance preferences.
 *
 * `system` means "follow the device setting" and is the default for text size and motion. There is
 * no system colour theme, so the theme always has an explicit value.
 *
 * The theme ids must match the `[data-theme='…']` blocks in `src/styles/theme.css`.
 */

export const THEME_IDS = ['amazone', 'warm', 'nacht', 'lila'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const TEXT_SIZE_IDS = ['system', 'small', 'medium', 'large'] as const;
export type TextSizeId = (typeof TEXT_SIZE_IDS)[number];

export const MOTION_IDS = ['system', 'reduced', 'standard'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export interface AppearancePreferences {
  readonly theme: ThemeId;
  readonly textSize: TextSizeId;
  readonly motion: MotionId;
}

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: 'amazone',
  textSize: 'system',
  motion: 'system',
};
