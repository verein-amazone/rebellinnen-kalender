/**
 * Persisted profile preferences: the name used in the Today greeting and the personal emoji shown
 * next to it. Both are optional-in-spirit scalars with a safe default, so they live alongside
 * `AppearancePreferences` in `localStorage` rather than in SQLite.
 */

/** `null` means no name has been set; the greeting is then shown without one. */
export interface ProfilePreferences {
  readonly name: string | null;
  readonly emoji: string;
}

/** Long enough for a real name, short enough to never wrap the Today greeting onto a third line. */
export const NAME_MAX_LENGTH = 40;

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  name: null,
  emoji: '⭐',
};
