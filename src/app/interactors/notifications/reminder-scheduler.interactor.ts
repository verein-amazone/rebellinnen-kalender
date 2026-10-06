import { inject, Injectable } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { formatDayShort } from '@app/cross-cutting/helpers/date-format';
import {
  DeviceNotifications,
  type PlannedNotification,
} from '@app/cross-cutting/infrastructure/notifications';
import { CalendarRepository, type ReminderCandidate } from '@app/data/calendar/calendar.repository';
import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';

/**
 * How many reminders are handed to the OS at once. iOS keeps at most 64 pending notifications per
 * app and silently drops the rest; staying below that leaves room and keeps the choice of which
 * ones survive ours rather than the system's. Every start, resume and edit tops the set up again.
 */
export const MAX_PENDING_REMINDERS = 60;

/**
 * How many upcoming occurrences are looked at. Each holds up to five reminders and they arrive in
 * start order, so this comfortably covers the first `MAX_PENDING_REMINDERS` reminders.
 */
const CANDIDATE_LIMIT = 300;

/**
 * An all-day reminder can fire after its appointment has started (on the day at 09:00), so the look
 * back must cover the latest such reminder: midnight plus this many minutes.
 */
const LOOK_BACK_MINUTES = 24 * 60;

/**
 * Turns the user's appointments into pending local notifications (#81).
 *
 * The OS gets the complete set every time: the next `MAX_PENDING_REMINDERS` reminders of app-owned
 * appointments in enabled calendars, replacing whatever was pending. Recomputing from the
 * materialized occurrences, rather than patching individual notifications, is what keeps edits,
 * series splits, cancelled occurrences, a zone change and an app update all correct with one code
 * path. Device-calendar events are never scheduled here - their alerts belong to the OS calendar.
 *
 * Calls are serialized and coalesced: a reschedule requested while one runs is folded into a single
 * follow-up run, so a burst of edits cannot interleave two replacements.
 */
@Injectable({ providedIn: 'root' })
export class ReminderSchedulerInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly preferences = inject(NotificationPreferencesStore);
  private readonly notifications = inject(DeviceNotifications);

  private running: Promise<void> | null = null;
  private requested = false;

  reschedule(): Promise<void> {
    this.requested = true;
    this.running ??= this.drain().finally(() => (this.running = null));
    return this.running;
  }

  /**
   * Calls `handler` with the occurrence id of a tapped reminder - also the one that launched the
   * app, which the OS holds back until a handler is registered.
   */
  onReminderTapped(handler: (occurrenceId: string) => void): void {
    this.notifications.onTapped(handler);
  }

  /** Withdraws every pending reminder, e.g. before all app data is cleared. */
  cancelAll(): Promise<void> {
    return this.notifications.cancelAll();
  }

  private async drain(): Promise<void> {
    while (this.requested) {
      this.requested = false;
      try {
        await this.run();
      } catch (error) {
        // A reminder that could not be scheduled must never break what triggered the reschedule.
        console.warn('Die Erinnerungen konnten nicht geplant werden.', error);
      }
    }
  }

  private async run(): Promise<void> {
    if (!this.notifications.isSupported()) {
      return;
    }

    const preferences = this.preferences.preferences();
    if (!preferences.enabled || (await this.notifications.permission()) !== 'granted') {
      await this.notifications.cancelAll();
      return;
    }

    const now = Temporal.Now.instant();
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const candidates = await this.repository.upcomingReminderCandidates(
      now.subtract({ minutes: LOOK_BACK_MINUTES }).toString(),
      CANDIDATE_LIMIT,
    );

    await this.notifications.replaceAll(
      planReminders(candidates, preferences, now, deviceZone).slice(0, MAX_PENDING_REMINDERS),
    );
  }
}

/** Every future reminder of the candidates, earliest first, with collision-free ids. */
export function planReminders(
  candidates: readonly ReminderCandidate[],
  defaults: {
    readonly timedDefaults: readonly number[];
    readonly allDayDefaults: readonly number[];
  },
  now: Temporal.Instant,
  deviceZone: string,
): PlannedNotification[] {
  const planned: { fireAt: Temporal.Instant; candidate: ReminderCandidate; minutes: number }[] = [];

  for (const candidate of candidates) {
    const reminders =
      candidate.reminders ?? (candidate.allDay ? defaults.allDayDefaults : defaults.timedDefaults);
    const anchor = candidate.allDay
      ? Temporal.PlainDate.from(candidate.startLocalDay).toZonedDateTime(deviceZone).toInstant()
      : Temporal.Instant.from(candidate.startUtc);

    for (const minutes of reminders) {
      const fireAt = anchor.subtract({ minutes });
      if (Temporal.Instant.compare(fireAt, now) > 0) {
        planned.push({ fireAt, candidate, minutes });
      }
    }
  }

  planned.sort(
    (a, b) =>
      Temporal.Instant.compare(a.fireAt, b.fireAt) ||
      a.candidate.occurrenceId.localeCompare(b.candidate.occurrenceId),
  );

  const usedIds = new Set<number>();
  return planned.map(({ fireAt, candidate, minutes }) => ({
    id: uniqueId(`${candidate.occurrenceId}|${minutes}`, usedIds),
    title: candidate.title,
    body: reminderBody(candidate, fireAt, deviceZone),
    atUtc: fireAt.toString(),
    target: candidate.occurrenceId,
  }));
}

/**
 * „Heute um 18:00 · Vereinslokal“, „Morgen, ganztägig“. Relative to the day the notification
 * appears, which is when it is read.
 */
function reminderBody(
  candidate: ReminderCandidate,
  fireAt: Temporal.Instant,
  deviceZone: string,
): string {
  const start = Temporal.Instant.from(candidate.startUtc).toZonedDateTimeISO(deviceZone);
  const startDay = candidate.allDay
    ? Temporal.PlainDate.from(candidate.startLocalDay)
    : start.toPlainDate();
  const daysAhead = fireAt
    .toZonedDateTimeISO(deviceZone)
    .toPlainDate()
    .until(startDay, { largestUnit: 'days' }).days;

  const day =
    daysAhead === 0 ? 'Heute' : daysAhead === 1 ? 'Morgen' : formatDayShort(startDay.toString());
  const when = candidate.allDay
    ? `${day}, ganztägig`
    : `${day} um ${start.toPlainTime().toString({ smallestUnit: 'minute' })}`;

  return candidate.location === null ? when : `${when} · ${candidate.location}`;
}

/**
 * A stable positive 31-bit id (FNV-1a) - the same reminder keeps its id across reschedules - moved
 * to the next free number in the rare case two reminders hash alike.
 */
function uniqueId(key: string, used: Set<number>): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  let id = hash & 0x7fffffff || 1;
  while (used.has(id)) {
    id = id === 0x7fffffff ? 1 : id + 1;
  }
  used.add(id);
  return id;
}
