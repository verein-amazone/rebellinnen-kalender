/**
 * One entry of the „Nicht vergessen“ list as it is stored.
 *
 * Timestamps are UTC ISO-8601 strings: SQLite has no date type, and ISO strings sort lexicographically
 * in the order the list is read in. `completedAt` is the completion state — `null` means open.
 */
export interface ReminderRecord {
  readonly id: string;
  readonly text: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * The manual order inside the entry's own section, ascending. Fractional so that moving an entry
   * between two others is a single-row write instead of a renumbering of everything below it.
   */
  readonly position: number;
}
