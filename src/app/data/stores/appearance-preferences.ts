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

/**
 * The text-size ladder. `system` follows the device, every other id is an absolute override that
 * replaces the device value. It stops at 2x - Apple's Larger Text floor - rather than following the
 * OS all the way to 3.12x, which the layout does not stay usable at.
 *
 * The scale factors live in `src/styles/theme.css`; these ids are only the keys into it.
 */
export const TEXT_SIZE_IDS = ['system', 'small', 'medium', 'large', 'xlarge', 'xxlarge'] as const;
export type TextSizeId = (typeof TEXT_SIZE_IDS)[number];

export const MOTION_IDS = ['system', 'reduced', 'standard'] as const;
export type MotionId = (typeof MOTION_IDS)[number];

/**
 * Whether the app may answer with the vibration motor. Its own preference rather than a part of
 * `motion`: someone can want the screen to hold still and still like the buzz, or the other way
 * round, and the OS setting behind `motion` says nothing about haptics.
 */
export const HAPTICS_IDS = ['on', 'off'] as const;
export type HapticsId = (typeof HAPTICS_IDS)[number];

export interface AppearancePreferences {
  readonly theme: ThemeId;
  readonly textSize: TextSizeId;
  readonly motion: MotionId;
  readonly haptics: HapticsId;
}

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: 'amazone',
  textSize: 'system',
  motion: 'system',
  haptics: 'on',
};
