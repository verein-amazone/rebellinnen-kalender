import { Temporal } from 'temporal-polyfill';

import { stringHash } from '@app/cross-cutting/helpers/string-hash';
import type { ContentItemRecord } from '@app/data/entities/content-item.record';

export interface SelectDailyImpulseInput {
  /** Items eligible for `today`, as returned by `ContentItemDao.listEligibleForDay`. */
  readonly eligible: readonly ContentItemRecord[];
  /** Ids shown on recent days, oldest first - excluded from today's pick where possible. */
  readonly recentIds: readonly string[];
  /** The impulse featured before today, which today's pick should not resemble; `null` if none. */
  readonly previous: ContentItemRecord | null;
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
 * The factor an item's weight is multiplied by for each trait it shares with the previous impulse,
 * so a Rebell*in after a Rebell*in is ten times less likely than the item's own weight would make it.
 * Unlikely, not excluded: when only alike items are eligible, one of them is still picked.
 */
const REPEAT_WEIGHT = 0.1;

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
 *
 * That weight is then lowered for every trait an item shares with the `previous` impulse (see
 * `varietyTraits`), so consecutive impulses tend to differ in kind rather than repeat it.
 */
export function selectDailyImpulse(input: SelectDailyImpulseInput): ContentItemRecord | null {
  const { eligible, recentIds, previous, today } = input;

  if (eligible.length === 0) {
    return null;
  }

  const recent = new Set(recentIds);
  const notRecentlyShown = eligible.filter((item) => !recent.has(item.id));
  const candidates = notRecentlyShown.length > 0 ? notRecentlyShown : eligible;

  return weightedPick(candidates, previous, today);
}

/**
 * What makes two impulses feel alike when one follows the other. Every trait counts on its own, so
 * an item sharing two of them with the previous impulse is lowered twice. Content with a video adds
 * a `video` trait once items can carry one, so that a video does not follow a video either.
 */
function varietyTraits(item: ContentItemRecord): readonly string[] {
  return [`kind:${item.kind}`];
}

/** `1 / windowDays`, lowered by `REPEAT_WEIGHT` once per trait shared with the previous impulse. */
function weightOf(item: ContentItemRecord, previousTraits: ReadonlySet<string>): number {
  const shared = varietyTraits(item).filter((trait) => previousTraits.has(trait)).length;
  return REPEAT_WEIGHT ** shared / windowDays(item);
}

/** How many days an item is eligible for - narrower windows get picked more often. */
function windowDays(item: ContentItemRecord): number {
  if (item.validFrom === null || item.validTo === null) {
    return EVERGREEN_WINDOW_DAYS;
  }

  const spanDays = Temporal.PlainDate.from(item.validFrom).until(item.validTo).days + 1;
  return Math.max(1, spanDays);
}

/**
 * Deterministically picks one item, weighted by `weightOf`: `today` is hashed into a
 * fraction of the total weight, then candidates are walked in order, accumulating weight, until
 * that fraction is reached - the same technique as picking a slice of a pie chart by angle.
 */
function weightedPick(
  candidates: readonly ContentItemRecord[],
  previous: ContentItemRecord | null,
  today: string,
): ContentItemRecord | null {
  const previousTraits = new Set(previous === null ? [] : varietyTraits(previous));
  const weights = candidates.map((item) => weightOf(item, previousTraits));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  const HASH_RESOLUTION = 1_000_000;
  const target = ((stringHash(today) % HASH_RESOLUTION) / HASH_RESOLUTION) * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += weights[i];
    if (target < cumulative) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1] ?? null;
}
