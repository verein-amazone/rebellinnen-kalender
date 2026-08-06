/**
 * Persisted preferences of the „Nicht vergessen“ list.
 *
 * These only decide where an entry *enters* a section and how long a completed one stays visible.
 * The order itself is the user's and lives in the `position` column, so nothing here can rearrange a
 * list the user has arranged by hand.
 */

export const REMINDER_PLACEMENT_IDS = ['top', 'bottom'] as const;
export type ReminderPlacementId = (typeof REMINDER_PLACEMENT_IDS)[number];

export interface ReminderPreferences {
  /** Where a newly added entry appears among the open ones. */
  readonly newItemPlacement: ReminderPlacementId;
  /** Where a just-completed entry appears among the completed ones. */
  readonly completedItemPlacement: ReminderPlacementId;
  /**
   * Whether a completed entry disappears once the local day it was completed on is over. It is only
   * hidden — the row stays in the database.
   */
  readonly hideCompletedAtDayChange: boolean;
}

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  newItemPlacement: 'top',
  completedItemPlacement: 'top',
  hideCompletedAtDayChange: true,
};
