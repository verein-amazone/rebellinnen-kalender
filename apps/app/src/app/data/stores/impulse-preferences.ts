/**
 * Persisted preferences of the Tagesimpuls on the Today page.
 *
 * Its own preference set rather than part of the appearance preferences: these describe how one
 * feature behaves, not how the app looks, and they are where a later „Tagesimpuls ausblenden“
 * belongs too.
 */

/**
 * When the Tagesimpuls greets with its short wave: every time the app is opened (a cold start or a
 * return from the background), only the first time on a given day, or never. Whether the phone
 * vibrates along is the app-wide vibration setting's call, and the app-wide motion setting still
 * silences the wave whichever value this one has.
 */
export const IMPULSE_GREETING_IDS = ['every-open', 'daily', 'off'] as const;
export type ImpulseGreetingId = (typeof IMPULSE_GREETING_IDS)[number];

export interface ImpulsePreferences {
  readonly greeting: ImpulseGreetingId;
}

export const DEFAULT_IMPULSE_PREFERENCES: ImpulsePreferences = {
  greeting: 'every-open',
};
