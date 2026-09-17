import type { Migration } from './migration';

/**
 * Repairs all-day appointments the event form stored one day too long.
 *
 * A `date` end names the last day an appointment covers - the convention the occurrence
 * materializer, the ICS parser and the device normalizer have always used. `EventForm` wrote the
 * day *after* that instead, so an all-day appointment on 18.9. was stored as ending on 19.9. and
 * rendered across both days. The form is fixed; this repairs what it already wrote on testers'
 * devices.
 *
 * Only rows with a `date` start and a `date` end where the end is strictly after the start are
 * touched: a timed appointment is unaffected, and an already-correct single-day row (end equal to
 * start) could not have come from the buggy form. Exceptions inherit the kind of their series when
 * they carry no start of their own.
 *
 * The third statement is the trigger for rebuilding the derived rows: `occurrences` is a cache
 * materialized from these records, and stamping the app sources' coverage with a version that is
 * not `RECURRENCE_ENGINE_VERSION` makes `CalendarRepository.hasOutdatedEngineRows()` report stale
 * data, which `CalendarMaintenanceInteractor.ensureConsistency()` answers with a full rebuild on
 * the next start or resume. Deleting the cached rows here instead would mean an interrupted
 * rebuild leaves appointments missing rather than a day too long, which is the worse failure - and
 * the stamp retries by itself until the rebuild commits.
 */
export const REPAIR_ALL_DAY_END: Migration = {
  toVersion: 16,
  statements: [
    `UPDATE app_items
        SET end_value = date(end_value, '-1 day')
      WHERE start_kind = 'date'
        AND end_kind = 'date'
        AND end_value > start_value;`,
    `UPDATE app_item_exceptions
        SET end_value = date(end_value, '-1 day')
      WHERE end_kind = 'date'
        AND end_value > COALESCE(start_value, original_start)
        AND (
          start_kind = 'date'
          OR (
            start_kind IS NULL
            AND EXISTS (
              SELECT 1 FROM app_items
               WHERE app_items.id = app_item_exceptions.series_id
                 AND app_items.start_kind = 'date'
            )
          )
        );`,
    `UPDATE source_coverage
        SET engine_version = 'repair-016-all-day-end'
      WHERE source_id IN (SELECT id FROM calendar_sources WHERE type = 'app');`,
  ],
};
