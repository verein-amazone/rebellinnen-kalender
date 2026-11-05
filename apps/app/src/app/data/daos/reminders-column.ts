/**
 * The `reminders` columns (`app_items`, `ics_items`, `occurrences`) hold a JSON array of minutes
 * before the start - `[15, 1440]` - or `NULL` for „follow the default reminders in the settings“.
 */
export function toRemindersColumn(reminders: readonly number[] | null): string | null {
  return reminders === null ? null : JSON.stringify(reminders);
}

/** A malformed value is read as „follow the defaults“ rather than failing the whole row. */
export function fromRemindersColumn(value: string | null | undefined): readonly number[] | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((minutes) => Number.isInteger(minutes))
      ? (parsed as number[])
      : null;
  } catch {
    return null;
  }
}
