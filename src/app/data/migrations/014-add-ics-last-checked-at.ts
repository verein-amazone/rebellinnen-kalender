import type { Migration } from './migration';

/**
 * When a subscription was last confirmed to be current, as opposed to when its content last
 * changed (`last_success_at`).
 *
 * The automatic refresh wants to know the former: a feed that answers `304 Not Modified` has been
 * successfully checked, but stores no new revision. Gating on `last_success_at` meant such a feed
 * counted as due forever and was re-downloaded on every launch and every foreground.
 *
 * `NULL` for existing rows; the refresh falls back to `last_success_at` for them, so upgrading does
 * not make every subscription due at once.
 */
export const ADD_ICS_LAST_CHECKED_AT: Migration = {
  toVersion: 14,
  statements: [`ALTER TABLE ics_subscriptions ADD COLUMN last_checked_at TEXT;`],
};
