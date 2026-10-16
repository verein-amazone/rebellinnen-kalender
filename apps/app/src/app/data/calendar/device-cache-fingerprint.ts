import { stringHash } from '@app/cross-cutting/helpers/string-hash';

import type { OccurrenceRecord } from '../entities/occurrence.record';

/**
 * Folded in after every field so that ("ab", "c") and ("a", "bc") - a title ending where a location
 * begins - cannot hash the same. A unit separator, because no value the calendar layer produces can
 * contain one.
 */
const FIELD_SEPARATOR = '\u001f';

/** The second hash's seed: any value other than the FNV offset basis the first one starts from. */
const SECOND_SEED = 0x01000193;

/**
 * A short digest of the rows a device refresh would write.
 *
 * The device provider has no change token on either platform - `lastModifiedDate` is iOS-only and
 * the plugin surfaces no store-change notification - so the only way to know whether the cached
 * rows are still correct is to normalize what the OS just handed us and compare it with what the
 * last refresh wrote. Stored next to the coverage row and compared on the next refresh, this turns
 * an unchanged launch from a full delete-and-rebuild of the window into no writes at all.
 *
 * Deliberately not a cryptographic digest: this detects change, it does not defend against anyone,
 * and `crypto.subtle` is async. Two `stringHash` runs with different seeds go over the same fields,
 * so a change has to collide in both 32-bit hashes at once to go unnoticed - far below the odds of
 * the database being wrong for some other reason.
 */
export function fingerprintOccurrences(rows: readonly OccurrenceRecord[]): string {
  // Sorted by id, because the fingerprint has to describe the *set* of rows: the native provider is
  // free to hand back the same events in a different order, and rewriting 4,700 unchanged rows over
  // that would defeat the point.
  const sorted = [...rows].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );

  let hashA = stringHash('');
  let hashB = SECOND_SEED;

  for (const row of sorted) {
    for (const field of fieldsOf(row)) {
      hashA = stringHash(field + FIELD_SEPARATOR, hashA);
      hashB = stringHash(field + FIELD_SEPARATOR, hashB);
    }
  }

  // The count is carried in the open rather than only folded in: it is the cheap half of the
  // comparison and it reads well in a log or a debugger.
  return `${sorted.length}-${hashA.toString(36)}-${hashB.toString(36)}`;
}

/**
 * Every field that reaches a column, in the order `OccurrenceDao` binds them. A column added to the
 * table without being added here would not register as a change.
 */
function fieldsOf(row: OccurrenceRecord): readonly string[] {
  return [
    row.id,
    row.sourceId,
    row.sourceType,
    row.calendarId,
    row.seriesId ?? '',
    row.originalStart ?? '',
    row.provenance,
    row.itemKind,
    row.itemId ?? '',
    row.title,
    row.location ?? '',
    row.description ?? '',
    row.isAllDay ? '1' : '0',
    row.start.kind,
    row.start.value,
    row.start.timeZone ?? '',
    row.end?.kind ?? '',
    row.end?.value ?? '',
    row.end?.timeZone ?? '',
    row.startUtc,
    row.endUtc,
    row.startLocalDay,
    row.endLocalDay,
    row.externalId ?? '',
  ];
}
