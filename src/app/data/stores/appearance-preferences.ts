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
 * How the Tagesimpuls announces itself the first time it is shown on a given day: with both
 * channels, with the wave alone, or not at all.
 *
 * One preference rather than two switches, because the two channels are two ways of saying the same
 * single thing and people think of it that way: „soll der Tagesimpuls sich melden, und wie laut“.
 * It is separate from `motion`, which governs animation everywhere in the app - a reduced-motion
 * setting still silences the wave here, whichever value this one has.
 */
export const IMPULSE_GREETING_IDS = ['full', 'motion', 'none'] as const;
export type ImpulseGreetingId = (typeof IMPULSE_GREETING_IDS)[number];

export interface AppearancePreferences {
  readonly theme: ThemeId;
  readonly textSize: TextSizeId;
  readonly motion: MotionId;
  readonly impulseGreeting: ImpulseGreetingId;
}

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: 'amazone',
  textSize: 'system',
  motion: 'system',
  impulseGreeting: 'full',
};
