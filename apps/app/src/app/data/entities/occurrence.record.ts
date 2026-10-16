import type { AppItemKind } from './app-item.record';
import type { CalendarSourceType } from './calendar-source.record';
import type { TemporalValue } from './temporal-value';

/**
 * Where a materialized row came from: a standalone item, a generated instance of a recurring
 * series, a generated instance replaced by an override, or a cached instance of a device event.
 * The source type says *whose* data it is; the provenance says *how* the row came to be.
 */
export const OCCURRENCE_PROVENANCES = [
  'standalone',
  'generated',
  'overridden',
  'device-cached',
] as const;
export type OccurrenceProvenance = (typeof OCCURRENCE_PROVENANCES)[number];

/**
 * One concrete calendar occurrence as the views consume it - derived, disposable, rebuildable.
 * Never the only representation of app-owned or ICS data.
 *
 * `id` is the source-scoped occurrence key (for example `app:<series>#<originalStart>`), stable
 * even when the occurrence is moved: `originalStart` is the identity, `start` the effective time.
 * `startUtc`/`endUtc` are computed sort/query keys (`endUtc` exclusive); `startLocalDay`/
 * `endLocalDay` are the device-zone days the occurrence touches, which is how all-day rows are
 * bucketed. Rows for `date`/`floating` values are computed in the device zone at materialization
 * time - legitimate because a zone change triggers a rebuild.
 */
export interface OccurrenceRecord {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceType: CalendarSourceType;
  readonly calendarId: string;
  readonly seriesId: string | null;
  readonly originalStart: string | null;
  readonly provenance: OccurrenceProvenance;
  readonly itemKind: AppItemKind;
  /** The owning `AppItemRecord.id` for app-owned rows (standalone or of a series); `null` otherwise. */
  readonly itemId: string | null;
  readonly title: string;
  readonly location: string | null;
  /**
   * A device event's description/notes, straight from the OS calendar. `null` for app-owned rows
   * (which keep their note on the canonical `app_items` record instead) and for ICS rows.
   */
  readonly description: string | null;
  readonly isAllDay: boolean;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly startLocalDay: string;
  readonly endLocalDay: string;
  /** The platform's own event id for device-cached rows. */
  readonly externalId: string | null;
}

/**
 * Which range of time a source's derived rows currently cover - materialization coverage for app
 * and ICS sources, fetch coverage for device sources. Derived and disposable like the rows it
 * describes. `engineVersion` records which recurrence engine generated the rows.
 */
export interface SourceCoverageRecord {
  readonly sourceId: string;
  readonly windowStartUtc: string;
  readonly windowEndUtc: string;
  readonly engineVersion: string;
  readonly updatedAt: string;
  /**
   * A digest of the external data these rows were built from, so a refresh can recognise that
   * rebuilding them would change nothing. Only the device source has external input to fingerprint;
   * `null` everywhere else, and `null` also means "unknown, rebuild to be sure".
   */
  readonly contentFingerprint: string | null;
}
