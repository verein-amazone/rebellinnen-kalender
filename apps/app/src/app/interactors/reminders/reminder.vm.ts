/**
 * One entry of the „Nicht vergessen“ list as a screen needs it.
 *
 * Separate from `ReminderRecord`: the view asks whether an entry is done, not when it was done, and
 * has no use for the bookkeeping timestamps.
 */
export interface Reminder {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}
