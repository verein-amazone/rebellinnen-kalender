import { inject, Injectable } from '@angular/core';

import { ReminderDao } from '@app/data/daos/reminder.dao';
import type { ReminderRecord } from '@app/data/entities/reminder.record';

import type { Reminder } from './reminder.vm';

/**
 * Long enough for a sentence, short enough to stay readable in a row at three times the text size.
 * The input carries the same limit, so the cap is visible before it bites.
 */
export const REMINDER_TEXT_MAX_LENGTH = 200;

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
 * Deliberately not a task manager — no dates, no priorities, no ordering by hand. Completing and
 * reopening are separate use cases rather than one flag setter, because that is how the screen and
 * its assistive-technology labels talk about them.
 *
 * Stateless: every method reads or writes and returns. The screen holds the list it is showing.
 */
@Injectable({ providedIn: 'root' })
export class ReminderListInteractor {
  private readonly reminders = inject(ReminderDao);

  async list(): Promise<Reminder[]> {
    const records = await this.reminders.listAll();
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
    });
  }

  async rename(id: string, text: string): Promise<void> {
    const normalized = normalizeReminderText(text);
    await this.reminders.updateText(id, normalized, new Date().toISOString());
  }

  async complete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.reminders.updateCompletedAt(id, now, now);
  }

  async reopen(id: string): Promise<void> {
    await this.reminders.updateCompletedAt(id, null, new Date().toISOString());
  }

  async remove(id: string): Promise<void> {
    await this.reminders.delete(id);
  }
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
