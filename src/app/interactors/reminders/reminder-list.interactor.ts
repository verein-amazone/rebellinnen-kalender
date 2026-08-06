import { inject, Injectable } from '@angular/core';

import { ReminderDao } from '@app/data/daos/reminder.dao';
import type { ReminderRecord } from '@app/data/entities/reminder.record';
import type { ReminderPlacementId } from '@app/data/stores/reminder-preferences';
import { RemindersStore } from '@app/data/stores/reminders.store';

import type { Reminder } from './reminder.vm';

/**
 * Long enough for a sentence, short enough to stay readable in a row at three times the text size.
 * The input carries the same limit, so the cap is visible before it bites.
 */
export const REMINDER_TEXT_MAX_LENGTH = 200;

/**
 * The gap left between two entries that enter a section at its top or bottom. Large enough that the
 * midpoints of a long series of drops stay far apart.
 */
const POSITION_STEP = 1000;

/**
 * Below this a midpoint stops separating its two neighbours, because the doubles round to the same
 * value. Reaching it takes about fifty drops into the same shrinking gap; the section is renumbered
 * when it happens.
 */
const POSITION_MIN_GAP = 1e-6;

/** Thrown when text reaches the interactor that a screen should never have submitted. */
export class ReminderTextInvalidError extends Error {
  constructor() {
    super('Der Text ist leer oder zu lang.');
    this.name = 'ReminderTextInvalidError';
  }
}

/**
 * The „Nicht vergessen“ list: a flat set of entries that are either open or done.
 *
 * Deliberately not a task manager — no dates and no priorities. The order is the user's own: open
 * entries first, completed ones below, and inside each section whatever arrangement was last
 * dragged. The preferences only decide where an entry *enters* a section, so nothing here rearranges
 * a list somebody sorted by hand.
 *
 * Completing and reopening are separate use cases rather than one flag setter, because that is how
 * the screen and its assistive-technology labels talk about them.
 *
 * Stateless: every method reads or writes and returns. The screen holds the list it is showing.
 */
@Injectable({ providedIn: 'root' })
export class ReminderListInteractor {
  private readonly reminders = inject(ReminderDao);
  private readonly preferences = inject(RemindersStore);

  async list(): Promise<Reminder[]> {
    const records = await this.visibleRecords();
    return records.map(toReminder);
  }

  async add(text: string): Promise<void> {
    const normalized = normalizeReminderText(text);
    const now = new Date().toISOString();

    await this.reminders.insert({
      id: crypto.randomUUID(),
      text: normalized,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      position: await this.entryPosition(false, this.preferences.preferences().newItemPlacement),
    });
  }

  async rename(id: string, text: string): Promise<void> {
    const normalized = normalizeReminderText(text);
    await this.reminders.updateText(id, normalized, new Date().toISOString());
  }

  async complete(id: string): Promise<void> {
    const now = new Date().toISOString();
    const placement = this.preferences.preferences().completedItemPlacement;

    await this.reminders.updateCompletion(id, now, await this.entryPosition(true, placement), now);
  }

  /**
   * Reopening puts the entry back among the open ones, so it uses the placement for new entries: it
   * is re-entering that list, and „oben“ there means the same thing it means for anything else that
   * appears in it.
   */
  async reopen(id: string): Promise<void> {
    const now = new Date().toISOString();
    const placement = this.preferences.preferences().newItemPlacement;

    await this.reminders.updateCompletion(
      id,
      null,
      await this.entryPosition(false, placement),
      now,
    );
  }

  async remove(id: string): Promise<void> {
    await this.reminders.delete(id);
  }

  /**
   * Moves an entry to `toIndex` inside its own section, counted over the entries the screen is
   * showing. The two sections never mix — a completed entry only moves among completed ones.
   *
   * The neighbours are taken from the visible entries, so an entry hidden by the day-change rule can
   * end up numerically between two visible ones. Nobody sees it, and switching the rule off only
   * makes it reappear in an order the user never expressed anyway.
   */
  async move(id: string, toIndex: number): Promise<void> {
    const visible = await this.visibleRecords();
    const moved = visible.find((record) => record.id === id);
    if (moved === undefined) {
      return;
    }

    const completed = moved.completedAt !== null;
    const section = visible.filter((record) => (record.completedAt !== null) === completed);
    const others = section.filter((record) => record.id !== id);
    const target = clamp(toIndex, 0, others.length);

    if (section[target]?.id === id) {
      return;
    }

    const before = others[target - 1] ?? null;
    const after = others[target] ?? null;
    const now = new Date().toISOString();

    if (before !== null && after !== null && after.position - before.position < POSITION_MIN_GAP) {
      const reordered = [...others.slice(0, target), moved, ...others.slice(target)];
      await this.reminders.reassignPositions(
        reordered.map((record, index) => ({
          id: record.id,
          position: (index + 1) * POSITION_STEP,
        })),
        now,
      );
      return;
    }

    await this.reminders.updatePosition(id, positionBetween(before, after), now);
  }

  /** The position an entry gets when it enters a section at the requested end. */
  private async entryPosition(completed: boolean, placement: ReminderPlacementId): Promise<number> {
    const { min, max } = await this.reminders.selectPositionRange(completed);

    return placement === 'top' ? (min ?? 0) - POSITION_STEP : (max ?? 0) + POSITION_STEP;
  }

  /**
   * Every entry, minus the completed ones the day-change preference hides.
   *
   * The cutoff is local midnight while `completedAt` is a UTC instant, so the comparison happens here
   * rather than in SQL: SQLite's `localtime` resolves against the host's zone, which is not the same
   * on the native plugin and in the browser build. Hiding is also a product rule driven by a
   * preference, and those do not belong in a DAO. Nothing is ever deleted.
   */
  private async visibleRecords(): Promise<ReminderRecord[]> {
    const records = await this.reminders.listAll();
    if (!this.preferences.preferences().hideCompletedAtDayChange) {
      return records;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();

    return records.filter(
      (record) => record.completedAt === null || Date.parse(record.completedAt) >= cutoff,
    );
  }
}

/** The place between two neighbours, or one step beyond the end the entry is moving to. */
function positionBetween(before: ReminderRecord | null, after: ReminderRecord | null): number {
  if (before !== null && after !== null) {
    return (before.position + after.position) / 2;
  }
  if (before !== null) {
    return before.position + POSITION_STEP;
  }
  if (after !== null) {
    return after.position - POSITION_STEP;
  }

  return POSITION_STEP;
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

function toReminder(record: ReminderRecord): Reminder {
  return { id: record.id, text: record.text, completed: record.completedAt !== null };
}

/**
 * Trims and validates. The screens keep empty and over-long text out on their own, so reaching the
 * error here means a caller is broken and should hear about it rather than write a blank entry.
 */
function normalizeReminderText(text: string): string {
  const trimmed = text.trim();

  if (trimmed.length === 0 || trimmed.length > REMINDER_TEXT_MAX_LENGTH) {
    throw new ReminderTextInvalidError();
  }

  return trimmed;
}
