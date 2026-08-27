import type { ContentItemRecord } from '@app/data/entities/content-item.record';

export interface SelectDailyImpulseInput {
  /** Items eligible for `today`, as returned by `ContentItemDao.listEligibleForDay`. */
  readonly eligible: readonly ContentItemRecord[];
  /** Ids shown on recent days, oldest first - excluded from today's pick where possible. */
  readonly recentIds: readonly string[];
  /** Today, `YYYY-MM-DD`. Also seeds the deterministic pick among equally-eligible candidates. */
  readonly today: string;
}

/**
 * Content with no `validFrom`/`validTo` bound (or open-ended on one side) is treated as if it were
 * eligible for this many days, when computing its selection weight below - long enough that it's
 * clearly less urgent than a dated item, without ever reaching zero probability.
 */
const EVERGREEN_WINDOW_DAYS = 90;

/**
 * Picks the Today page's featured content item from today's eligible items.
 *
 * Pure and stateless: the caller supplies `today` explicitly, so the pick is exactly reproducible
 * from its inputs and needs no clock or `Math.random()` - the "randomness" among eligible
 * candidates is instead derived from `today` itself, so the same day always resolves to the same
 * item (the store is what keeps that item on screen for the rest of the day) while different days
 * routinely resolve to different ones.
 *
 * `recentIds` (the highlight cooldown, see `DailyImpulseStore`) is excluded first to avoid
 * repeatedly surfacing the same small set of items - unless excluding it would leave nothing, in
 * which case the exclusion is dropped for this pick rather than returning `null` while eligible
 * content still exists.
 *
 * Among what's left, each item is weighted by how narrow its eligible window is: an item bound to
 * a specific `validFrom`–`validTo` span gets a weight of `1 / windowDays`, so a one-day item is far
 * more likely to be picked than a week-long one, which in turn beats evergreen content - without
 * ever hard-excluding anything the way a strict "dated beats evergreen" rule would.
 */
export function selectDailyImpulse(input: SelectDailyImpulseInput): ContentItemRecord | null {
  const { eligible, recentIds, today } = input;

  if (eligible.length === 0) {
    return null;
  }

  const recent = new Set(recentIds);
  const notRecentlyShown = eligible.filter((item) => !recent.has(item.id));
  const candidates = notRecentlyShown.length > 0 ? notRecentlyShown : eligible;

  return weightedPick(candidates, today);
}

/** How many days an item is eligible for - narrower windows get picked more often. */
function windowDays(item: ContentItemRecord): number {
  if (item.validFrom === null || item.validTo === null) {
    return EVERGREEN_WINDOW_DAYS;
  }

  const from = Date.parse(`${item.validFrom}T00:00:00Z`);
  const to = Date.parse(`${item.validTo}T00:00:00Z`);
  const spanDays = Math.round((to - from) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, spanDays);
}

/**
 * Deterministically picks one item, weighted by `1 / windowDays`: `today` is hashed into a
 * fraction of the total weight, then candidates are walked in order, accumulating weight, until
 * that fraction is reached - the same technique as picking a slice of a pie chart by angle.
 */
function weightedPick(
  candidates: readonly ContentItemRecord[],
  today: string,
): ContentItemRecord | null {
  const weights = candidates.map((item) => 1 / windowDays(item));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const HASH_RESOLUTION = 1_000_000;
  const target = ((dayHash(today) % HASH_RESOLUTION) / HASH_RESOLUTION) * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1] ?? null;
}

/** A small, deterministic, non-cryptographic hash of a day string, used only to pick a weight. */
function dayHash(day: string): number {
  let hash = 0;
  for (let i = 0; i < day.length; i++) {
    hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  }
  return hash;
}
