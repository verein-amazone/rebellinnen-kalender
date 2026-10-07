import { inject, Injectable } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { deviceLocalDay } from '@app/cross-cutting/helpers/device-local-day';
import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import {
  countGeneratedBefore,
  shiftEnd,
} from '@app/data/calendar/recurrence/occurrence-materializer';
import { continuedAfter, toUtcInstantString } from '@app/data/calendar/recurrence/rrule-tools';
import type {
  AppItemExceptionRecord,
  AppItemKind,
  AppItemRecord,
} from '@app/data/entities/app-item.record';
import type { TemporalValue } from '@app/data/entities/temporal-value';
import {
  parseRecurrenceRule,
  rebaseRecurrenceRule,
  WEEKDAYS,
  weekdayOf,
} from '@app/data/calendar/recurrence/recurrence-rule';
import {
  NativeCalendarGateway,
  type DeviceEventRecurrence,
} from '@app/data/gateways/native-calendar.gateway';
import { NotificationPreferencesStore } from '@app/data/stores/notification-preferences.store';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import { ReminderSchedulerInteractor } from '@app/interactors/notifications/reminder-scheduler.interactor';

// Views describe times through the interactor's types; the storage type is the domain language.
export type { TemporalValue } from '@app/data/entities/temporal-value';

export const APP_EVENT_TITLE_MAX_LENGTH = 200;

export class AppEventTitleInvalidError extends Error {
  constructor() {
    super('Der Titel darf nicht leer und höchstens 200 Zeichen lang sein.');
    this.name = 'AppEventTitleInvalidError';
  }
}

/** Everything needed to create an app-owned item. */
export interface AppEventDraft {
  readonly calendarId: string;
  readonly kind: AppItemKind;
  readonly title: string;
  readonly location: string | null;
  readonly note: string | null;
  readonly start: TemporalValue;
  readonly end: TemporalValue | null;
  readonly rrule: string | null;
  /**
   * Minutes before the start to be reminded at. Absent or `null` follows the default reminders in
   * the settings; `[]` is an explicit „no reminder“.
   */
  readonly reminders?: readonly number[] | null;
}

/** A partial edit; absent fields keep their current value. */
export interface AppEventChanges {
  readonly title?: string;
  readonly location?: string | null;
  readonly note?: string | null;
  readonly start?: TemporalValue;
  readonly end?: TemporalValue | null;
  readonly rrule?: string | null;
  /** Reminders belong to the whole series, like the rule; see `AppEventDraft.reminders`. */
  readonly reminders?: readonly number[] | null;
}

/**
 * The use cases for creating and editing app-owned calendar items, including the three scopes for
 * recurring series: only this occurrence, this and following, all occurrences.
 *
 * Stateless. Owns the clock, the ids and the device zone; the repository owns the transactions.
 */
@Injectable({ providedIn: 'root' })
export class AppEventEditingInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly nativeCalendar = inject(NativeCalendarGateway);
  private readonly deviceSync = inject(DeviceCalendarSyncInteractor);
  private readonly reminders = inject(ReminderSchedulerInteractor);
  private readonly notificationPreferences = inject(NotificationPreferencesStore);

  /**
   * The full canonical record behind an item, for a consumer that needs a field the read-model
   * (`CalendarOccurrence`) does not carry - currently the note, for the detail page's read view and
   * its edit-mode prefill. Kept here rather than exposing `CalendarRepository` to views, per the
   * architecture's DAO/repository-injection boundary.
   */
  findRecord(itemId: string): Promise<AppItemRecord | null> {
    return this.repository.findItem(itemId);
  }

  /**
   * Creates a standalone item or a new series and returns its id - unless `calendarId` names a
   * writable device calendar, in which case the appointment is written straight into the OS
   * calendar via `createDeviceEvent` instead. A rule on such a draft becomes a native series that
   * the OS owns from then on.
   */
  async create(draft: AppEventDraft): Promise<string> {
    const target = await this.repository.findCalendarWithSource(draft.calendarId);
    if (target !== null && target.source.type === 'device') {
      return this.createDeviceEvent(target.calendar.externalId ?? draft.calendarId, draft);
    }

    const context = this.context();
    const record: AppItemRecord = {
      id: crypto.randomUUID(),
      calendarId: draft.calendarId,
      kind: draft.kind,
      title: validatedTitle(draft.title),
      location: draft.location,
      note: draft.note,
      start: draft.start,
      end: draft.end,
      rrule: draft.rrule,
      predecessorSeriesId: null,
      ruleRevision: 0,
      reminders: draft.reminders ?? null,
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    };

    await this.repository.createItem(record, context);
    void this.reminders.reschedule();
    return record.id;
  }

  /**
   * Writes a standalone event directly into the OS calendar and refreshes the device cache so it
   * appears immediately, instead of waiting for the next automatic sync. No canonical app row is
   * created - the OS is the record from the start, the same as any other device event.
   */
  private async createDeviceEvent(nativeCalendarId: string, draft: AppEventDraft): Promise<string> {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isAllDay = draft.start.kind === 'date';
    const startUtc = toUtcInstantString(draft.start, deviceZone);
    // `DeviceEventDraft.endUtc` is exclusive, like every other `*_utc` value in the data layer,
    // while a `date` end names the last day the appointment covers - so an all-day end becomes the
    // midnight after it. The gateway turns that back into whatever the platform's calendar store
    // expects.
    const draftEnd = draft.end ?? draft.start;
    const endUtc = toUtcInstantString(
      isAllDay ? exclusiveEndOfAllDay(draftEnd) : draftEnd,
      deviceZone,
    );

    const { eventId } = await this.nativeCalendar.createEvent({
      calendarId: nativeCalendarId,
      title: validatedTitle(draft.title),
      location: draft.location,
      startUtc,
      endUtc,
      isAllDay,
      alertMinutesBefore: this.deviceAlerts(draft, isAllDay),
      recurrence:
        draft.rrule === null ? null : toDeviceRecurrence(draft.rrule, draft.start, deviceZone),
    });

    await this.deviceSync.refresh({ force: true });
    return eventId;
  }

  /**
   * The reminders a device event is written with. The OS calendar delivers them, so they follow the
   * same switch and defaults as the app's own reminders: none while reminders are off.
   */
  private deviceAlerts(draft: AppEventDraft, isAllDay: boolean): readonly number[] {
    const preferences = this.notificationPreferences.preferences();
    if (!preferences.enabled) {
      return [];
    }
    return draft.reminders ?? (isAllDay ? preferences.allDayDefaults : preferences.timedDefaults);
  }

  /** Edits a standalone item, or every occurrence of a series. */
  async updateAll(itemId: string, changes: AppEventChanges): Promise<void> {
    const context = this.context();
    const item = await this.repository.findItem(itemId);
    if (item === null) {
      return;
    }

    // A moved series keeps its pattern relative to its start: the weekdays move along and UNTIL
    // follows a switch between all-day and timed.
    const rrule =
      changes.rrule !== undefined
        ? changes.rrule
        : item.rrule !== null && changes.start !== undefined
          ? rebaseRecurrenceRule(item.rrule, item.start, changes.start, context.timeZone)
          : item.rrule;
    const patternChanged =
      rrule !== item.rrule ||
      (changes.start !== undefined && changes.start.value !== item.start.value);

    await this.repository.updateItem(
      {
        ...item,
        title: changes.title !== undefined ? validatedTitle(changes.title) : item.title,
        location: changes.location !== undefined ? changes.location : item.location,
        note: changes.note !== undefined ? changes.note : item.note,
        start: changes.start ?? item.start,
        end: changes.end !== undefined ? changes.end : item.end,
        rrule,
        ruleRevision: patternChanged ? item.ruleRevision + 1 : item.ruleRevision,
        reminders: changes.reminders !== undefined ? changes.reminders : item.reminders,
        updatedAt: context.nowUtc,
      },
      context,
    );
    void this.reminders.reschedule();
  }

  /**
   * Edits every occurrence of a series from the form of one of them. The form shows that
   * occurrence's day, so a changed start is read as a shift relative to it and applied to the
   * series' own start - moving „all appointments“ from Wednesday to Thursday moves the whole
   * series by a day, instead of restarting it on the Thursday the user happened to open.
   */
  async updateSeries(
    seriesId: string,
    occurrenceStart: TemporalValue,
    changes: AppEventChanges,
  ): Promise<void> {
    const item = await this.repository.findItem(seriesId);
    if (item === null) {
      return;
    }

    await this.updateAll(
      seriesId,
      rebasedOnSeries(item, occurrenceStart, changes, this.context().timeZone),
    );
  }

  /** Edits only one occurrence of a series: stores an override, never a new authoritative event. */
  async updateOccurrence(
    seriesId: string,
    originalStart: string,
    changes: AppEventChanges,
  ): Promise<void> {
    const context = this.context();
    const exception: AppItemExceptionRecord = {
      seriesId,
      originalStart,
      status: 'override',
      title: changes.title !== undefined ? validatedTitle(changes.title) : null,
      location: changes.location !== undefined ? changes.location : null,
      note: changes.note !== undefined ? changes.note : null,
      start: changes.start ?? null,
      end: changes.end !== undefined ? changes.end : null,
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    };

    await this.repository.applyException(exception, context);
    void this.reminders.reschedule();
  }

  /** Cancels only one occurrence of a series. */
  async cancelOccurrence(seriesId: string, originalStart: string): Promise<void> {
    const context = this.context();
    await this.repository.applyException(
      {
        seriesId,
        originalStart,
        status: 'cancelled',
        title: null,
        location: null,
        note: null,
        start: null,
        end: null,
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      },
      context,
    );
    void this.reminders.reschedule();
  }

  /**
   * Edits this and all following occurrences: the old series ends before the selected occurrence
   * and a linked continuation starts there with the changes applied.
   */
  async updateFollowing(
    seriesId: string,
    originalStart: string,
    changes: AppEventChanges,
  ): Promise<void> {
    const context = this.context();
    const master = await this.repository.findItem(seriesId);
    if (master === null || master.rrule === null) {
      return;
    }

    const splitStart: TemporalValue = {
      kind: master.start.kind,
      value: originalStart,
      timeZone: master.start.timeZone,
    };
    const start = changes.start ?? splitStart;
    const end =
      changes.end !== undefined
        ? changes.end
        : shiftEnd(master.start, master.end, start, context.timeZone);

    const continuation: AppItemRecord = {
      id: crypto.randomUUID(),
      calendarId: master.calendarId,
      kind: master.kind,
      title: changes.title !== undefined ? validatedTitle(changes.title) : master.title,
      location: changes.location !== undefined ? changes.location : master.location,
      note: changes.note !== undefined ? changes.note : master.note,
      start,
      end,
      rrule: continuationRule(
        master,
        master.rrule,
        originalStart,
        splitStart,
        start,
        changes,
        context.timeZone,
      ),
      predecessorSeriesId: seriesId,
      ruleRevision: 0,
      reminders: changes.reminders !== undefined ? changes.reminders : master.reminders,
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    };

    await this.repository.splitSeries(seriesId, originalStart, continuation, context);
    void this.reminders.reschedule();
  }

  /** Deletes this and all following occurrences by ending the series before the selected one. */
  async deleteFollowing(seriesId: string, originalStart: string): Promise<void> {
    await this.repository.deleteFollowing(seriesId, originalStart, this.context());
    void this.reminders.reschedule();
  }

  /** Deletes a standalone item or an entire series. */
  async deleteItem(itemId: string): Promise<void> {
    await this.repository.deleteItem(itemId);
    void this.reminders.reschedule();
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

/**
 * The rule of a „this and following“ continuation. An unchanged rule carries on where the old
 * series stops - a finite series stays finite, with what is left of its COUNT - and moves along
 * with a changed start. A rule from the form is anchored on the continuation's own start, which is
 * its first occurrence.
 */
function continuationRule(
  master: AppItemRecord,
  masterRule: string,
  originalStart: string,
  splitStart: TemporalValue,
  start: TemporalValue,
  changes: AppEventChanges,
  deviceZone: string,
): string | null {
  if (changes.rrule === null) {
    return null;
  }
  if (changes.rrule !== undefined) {
    return rebaseRecurrenceRule(changes.rrule, start, start, deviceZone);
  }

  const remaining = continuedAfter(
    masterRule,
    countGeneratedBefore(master, originalStart, deviceZone),
  );
  return rebaseRecurrenceRule(remaining, splitStart, start, deviceZone);
}

function validatedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > APP_EVENT_TITLE_MAX_LENGTH) {
    throw new AppEventTitleInvalidError();
  }

  return trimmed;
}

/**
 * The changes with a changed start/end moved from the edited occurrence's day onto the series'
 * own start day, keeping the shift between the two.
 */
function rebasedOnSeries(
  item: AppItemRecord,
  occurrenceStart: TemporalValue,
  changes: AppEventChanges,
  deviceZone: string,
): AppEventChanges {
  if (changes.start === undefined) {
    return changes;
  }

  const editedDay = Temporal.PlainDate.from(deviceLocalDay(changes.start, deviceZone));
  const shift = Temporal.PlainDate.from(deviceLocalDay(occurrenceStart, deviceZone)).until(
    editedDay,
    {
      largestUnit: 'days',
    },
  ).days;
  const seriesDay = Temporal.PlainDate.from(deviceLocalDay(item.start, deviceZone)).add({
    days: shift,
  });
  const offset = editedDay.until(seriesDay, { largestUnit: 'days' }).days;

  return {
    ...changes,
    start: onDay(changes.start, seriesDay),
    end:
      changes.end === undefined || changes.end === null
        ? changes.end
        : onDay(
            changes.end,
            Temporal.PlainDate.from(deviceLocalDay(changes.end, deviceZone)).add({ days: offset }),
          ),
  };
}

/** The same wall time (or the same all-day kind) on another day. */
function onDay(value: TemporalValue, day: Temporal.PlainDate): TemporalValue {
  if (value.kind === 'utc') {
    // Never authored by the form, which writes zoned or date values; left untouched.
    return value;
  }
  return { ...value, value: `${day.toString()}${value.value.slice(10)}` };
}

/**
 * A stored rule in the shape the OS calendar can hold. The form only authors rules
 * `parseRecurrenceRule` understands; anything else would be written as a single event.
 */
function toDeviceRecurrence(
  rrule: string,
  start: TemporalValue,
  deviceZone: string,
): DeviceEventRecurrence | null {
  const rule = parseRecurrenceRule(rrule, start, deviceZone);
  if (rule === null) {
    return null;
  }

  const weekdays =
    rule.frequency === 'weekly'
      ? WEEKDAYS.flatMap((day, index) =>
          rule.weekdays.includes(day) || weekdayOf(deviceLocalDay(start, deviceZone)) === day
            ? [index + 1]
            : [],
        )
      : [];

  return {
    frequency: rule.frequency,
    interval: rule.interval,
    weekdays,
    count: rule.end.kind === 'count' ? rule.end.count : null,
    untilUtc:
      rule.end.kind === 'until'
        ? Temporal.PlainDate.from(rule.end.date)
            .add({ days: 1 })
            .toZonedDateTime(deviceZone)
            .subtract({ seconds: 1 })
            .toInstant()
            .toString()
        : null,
  };
}

/** The day after an all-day appointment's last day, as a `date` value. */
function exclusiveEndOfAllDay(end: TemporalValue): TemporalValue {
  return {
    kind: 'date',
    value: Temporal.PlainDate.from(end.value).add({ days: 1 }).toString(),
    timeZone: null,
  };
}
