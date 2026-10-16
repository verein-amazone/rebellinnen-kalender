/**
 * Persisted appearance preferences.
 *
 * `system` means "follow the device setting" and is the default for text size and motion. The
 * colour theme can follow the device too, but defaults to an explicit palette: Amazone is the
 * app's face, so a first start shows it whatever the device's dark mode says.
 */

/**
 * The colour palettes. Their ids must match the `[data-theme='…']` blocks in
 * `src/styles/theme.css`.
 */
export const PALETTE_IDS = ['amazone', 'warm', 'nacht', 'lila'] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

/**
 * The selectable colour themes: every palette, plus `system`, which follows the device's dark mode
 * and resolves to a palette before it reaches the document (see `AppearanceInteractor`).
 */
export const THEME_IDS = ['system', ...PALETTE_IDS] as const;
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
 * Whether the app may vibrate at all - the Tagesimpuls greeting and the short confirmations
 * (appointment saved, entry ticked off, …) alike. One switch for every haptic, next to the motion
 * setting, because it is the same kind of decision: how much the app may make itself felt.
 *
 * Independent of `motion`: reduced motion is about what moves on screen, and someone who turns
 * animations down may still want the confirmation taps.
 */
export const VIBRATION_IDS = ['on', 'off'] as const;
export type VibrationId = (typeof VIBRATION_IDS)[number];

export interface AppearancePreferences {
  readonly theme: ThemeId;
  readonly textSize: TextSizeId;
  readonly motion: MotionId;
  readonly vibration: VibrationId;
}

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: 'amazone',
  textSize: 'system',
  motion: 'system',
  vibration: 'on',
};
