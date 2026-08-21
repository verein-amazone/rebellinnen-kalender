import type { ContentItemRecord } from '@app/data/entities/content-item.record';

export interface SelectDailyImpulseInput {
  /** Items eligible for `today`, as returned by `ContentItemDao.listEligibleForDay`. */
  readonly eligible: readonly ContentItemRecord[];
  /** Ids shown on recent days, oldest first — excluded from today's pick where possible. */
  readonly recentIds: readonly string[];
  /** Today, `YYYY-MM-DD`. Also seeds the deterministic pick among equally-eligible candidates. */
  readonly today: string;
}

/**
 * Picks the Today page's featured content item from today's eligible items.
 *
 * Pure and stateless: the caller supplies `today` explicitly, so the pick is exactly reproducible
 * from its inputs and needs no clock or `Math.random()` — the "randomness" among equally-eligible
 * candidates is instead derived from `today` itself, so the same day always resolves to the same
 * item (the store is what keeps that item on screen for the rest of the day) while different days
 * routinely resolve to different ones.
 *
 * Priority: an item with a `validFrom`/`validTo` bound (content meant for a specific date or period)
 * wins over evergreen content, per the issue's "give date-specific content precedence" rule. Within
 * whichever pool applies, `recentIds` is excluded to avoid repeatedly presenting the same small set
 * of items — unless excluding it would leave nothing, in which case the exclusion is dropped for
 * this pick rather than returning `null` while eligible content still exists.
 */
export function selectDailyImpulse(input: SelectDailyImpulseInput): ContentItemRecord | null {
  const { eligible, recentIds, today } = input;

  if (eligible.length === 0) {
    return null;
  }

  const dateSpecific = eligible.filter((item) => item.validFrom !== null || item.validTo !== null);
  const pool = dateSpecific.length > 0 ? dateSpecific : eligible;

  const recent = new Set(recentIds);
  const notRecentlyShown = pool.filter((item) => !recent.has(item.id));
  const candidates = notRecentlyShown.length > 0 ? notRecentlyShown : pool;

  const index = dayHash(today) % candidates.length;
  return candidates[index] ?? null;
}

/** A small, deterministic, non-cryptographic hash of a day string, used only to pick an index. */
function dayHash(day: string): number {
  let hash = 0;
  for (let i = 0; i < day.length; i++) {
    hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  }
  return hash;
}
