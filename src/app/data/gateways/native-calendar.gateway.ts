import { inject, Injectable } from '@angular/core';
import type { CreateEventOptions } from '@ebarooni/capacitor-calendar';
import { Temporal } from 'temporal-polyfill';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import {
  CalendarPermissionScope,
  CAPACITOR_CALENDAR,
} from '@app/cross-cutting/plugins/calendar.plugin';

import { utcInstantFromEpochMilliseconds } from '../calendar/utc-instant';

/** The read permission as the app reasons about it - no plugin types above this line. */
export type DeviceCalendarPermission = 'granted' | 'denied' | 'prompt';

/** One calendar as the operating system reports it. */
export interface DeviceCalendar {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly writable: boolean;
  /**
   * The native account/source this calendar belongs to (iCloud, a Google account, Exchange, …),
   * for grouping calendars from the same account in the management screen. iOS reports a real
   * `CalendarSource` with a stable id; Android has no such concept in the plugin, so its account
   * name doubles as both id and name there. `null` when the platform reports neither.
   */
  readonly sourceId: string | null;
  readonly sourceName: string | null;
}

/** What the app supplies to write a new standalone event directly into a writable device calendar. */
export interface DeviceEventDraft {
  readonly calendarId: string;
  readonly title: string;
  readonly location: string | null;
  readonly startUtc: string;
  /** Exclusive, like every other `*Utc` end in the data layer - midnight after an all-day's last day. */
  readonly endUtc: string;
  readonly isAllDay: boolean;
  /**
   * Native alerts, in minutes before the start - for an all-day event, before midnight of its
   * first day. Empty for none.
   */
  readonly alertMinutesBefore: readonly number[];
  /** Makes the event a native series; the OS owns and expands it from then on. */
  readonly recurrence: DeviceEventRecurrence | null;
}

/** A repetition pattern in the shape the OS calendar stores can hold - plugin-free. */
export interface DeviceEventRecurrence {
  readonly frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  readonly interval: number;
  /** ISO weekdays, 1 = Monday … 7 = Sunday; only for a weekly pattern. */
  readonly weekdays: readonly number[];
  readonly count: number | null;
  /** The last instant an occurrence may start at, inclusive. */
  readonly untilUtc: string | null;
}

/**
 * One concrete event instance the OS returned for a range. The platform has already expanded
 * recurrence; the app never reconstructs native recurrence rules.
 */
export interface DeviceEventInstance {
  readonly eventId: string;
  readonly calendarId: string | null;
  readonly title: string;
  readonly location: string | null;
  readonly description: string | null;
  readonly startUtc: string;
  readonly endUtc: string;
  readonly isAllDay: boolean;
  readonly timeZone: string | null;
}

/**
 * The device calendar boundary - the only importer of `@ebarooni/capacitor-calendar`.
 *
 * iOS EventKit and the Android Calendar Provider stay authoritative; this gateway only reads.
 * Instances are translated to plugin-free shapes here, including the platform difference that iOS
 * repeats one event id for every instance of a series while Android instances carry their own
 * times - which is why identity above this gateway always includes the occurrence start.
 *
 * All-day instants leave this gateway on both platforms as device-zone midnights, the convention
 * every all-day `*Utc` value above it follows.
 */
@Injectable({ providedIn: 'root' })
export class NativeCalendarGateway {
  private readonly plugin = inject(CAPACITOR_CALENDAR);
  private readonly platform = inject(DevicePlatformService);

  async checkReadPermission(): Promise<DeviceCalendarPermission> {
    const { result } = await this.plugin.checkPermission({
      scope: CalendarPermissionScope.READ_CALENDAR,
    });
    return toPermission(result);
  }

  /** Prompts the user; only ever called from an explicit „connect device calendars“ action. */
  async requestReadAccess(): Promise<DeviceCalendarPermission> {
    const { result } = await this.plugin.requestFullCalendarAccess();
    return toPermission(result);
  }

  async listCalendars(): Promise<DeviceCalendar[]> {
    const { result } = await this.plugin.listCalendars();
    return result.map((calendar) => ({
      id: calendar.id,
      // The plugin types `title` as nullable: iOS always reports one, the Android provider may not.
      // A calendar still has to be identifiable in the settings list, so fall back to the Android
      // internal name, then to the account it belongs to, and only then to the raw id.
      name: calendar.title ?? calendar.internalTitle ?? calendar.accountName ?? calendar.id,
      color: calendar.color ?? null,
      writable: calendar.allowsContentModifications ?? false,
      // `source` is iOS-only; Android has no separate id and reports `accountName` instead.
      sourceId: calendar.source?.id ?? calendar.accountName ?? null,
      sourceName: calendar.source?.title ?? calendar.accountName ?? null,
    }));
  }

  /**
   * The concrete instances overlapping the range, multi-day events included. `timeZone` is the
   * device zone whose midnights an all-day instance is reported at.
   */
  async listEventInstances(
    fromUtc: string,
    toUtc: string,
    timeZone: string,
  ): Promise<DeviceEventInstance[]> {
    const { result } = await this.plugin.listEventsInRange({
      from: Date.parse(fromUtc),
      to: Date.parse(toUtc),
    });

    return result.map((event) => {
      const isAndroidAllDay = event.isAllDay && this.platform.platform === 'android';
      const toInstant = (epochMilliseconds: number): string =>
        isAndroidAllDay
          ? deviceMidnightOfUtcDay(epochMilliseconds, timeZone)
          : utcInstantFromEpochMilliseconds(epochMilliseconds);

      return {
        eventId: event.id,
        calendarId: event.calendarId,
        title: event.title,
        location: event.location,
        description: event.description,
        startUtc: toInstant(event.startDate),
        endUtc: toInstant(event.endDate),
        isAllDay: event.isAllDay,
        timeZone: event.timezone,
      };
    });
  }

  /** Opens the system calendar's own edit prompt for a writable device event. */
  async openEventForEditing(eventId: string): Promise<void> {
    await this.plugin.modifyEventWithPrompt({ id: eventId });
  }

  /**
   * Writes a new standalone event straight into a writable device calendar - a direct OS write,
   * never a canonical app record. The caller refreshes the device cache afterwards so the new
   * event shows up without waiting for the next automatic sync.
   *
   * The reminders become native alerts, so the OS calendar delivers them like any other event's -
   * the app schedules no notifications of its own for a device event. Negative minutes mean
   * „before“ in the plugin's convention.
   */
  async createEvent(draft: DeviceEventDraft): Promise<{ eventId: string }> {
    const { id } = await this.plugin.createEvent({
      calendarId: draft.calendarId,
      title: draft.title,
      location: draft.location ?? undefined,
      startDate: Date.parse(draft.startUtc),
      endDate: this.nativeEndDate(draft),
      isAllDay: draft.isAllDay,
      alerts:
        draft.alertMinutesBefore.length === 0
          ? undefined
          : draft.alertMinutesBefore.map((minutes) => -minutes),
      recurrence: draft.recurrence === null ? undefined : toPluginRecurrence(draft.recurrence),
    });
    // The plugin types `id` as nullable because its web implementation produces an `.ics` file
    // instead of writing to a calendar store. On iOS and Android a successful create always
    // returns one, so a missing id here is a broken write, not a case the caller can handle.
    if (id === null) {
      throw new Error('The device calendar did not return an id for the created event.');
    }
    return { eventId: id };
  }

  /**
   * The end the plugin wants, from the app's own exclusive one.
   *
   * The plugin reads an all-day event's end as the last local day it covers on both platforms -
   * EventKit natively, Android since 8.7.1, where the plugin itself turns that day into the
   * exclusive UTC midnight `CalendarContract` stores. Handing it the exclusive midnight would
   * create an appointment one day too long. The last instant before the exclusive end names that
   * last day without any date arithmetic in a time zone.
   */
  private nativeEndDate(draft: DeviceEventDraft): number {
    const endUtc = Date.parse(draft.endUtc);

    return draft.isAllDay ? endUtc - 1 : endUtc;
  }
}

/**
 * `CalendarContract` stores and expands an all-day event at UTC midnights, so its instances arrive
 * with the right calendar date only when read in UTC. Bucketed in the device zone instead, the
 * appointment would grow by a day - after it east of UTC, before it west of UTC.
 */
function deviceMidnightOfUtcDay(epochMilliseconds: number, timeZone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(epochMilliseconds)
    .toZonedDateTimeISO('UTC')
    .toPlainDate()
    .toZonedDateTime(timeZone)
    .toInstant()
    .toString({ smallestUnit: 'second' });
}

/** The package exports the options but not the rule type itself. */
type PluginRecurrence = NonNullable<CreateEventOptions['recurrence']>;

function toPluginRecurrence(recurrence: DeviceEventRecurrence): PluginRecurrence {
  return {
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    byWeekDay: recurrence.weekdays.length > 0 ? [...recurrence.weekdays] : undefined,
    // The plugin ignores `end` once `count` is set, so only one of them is ever passed.
    count: recurrence.count ?? undefined,
    end:
      recurrence.count === null && recurrence.untilUtc !== null
        ? Date.parse(recurrence.untilUtc)
        : undefined,
  };
}

function toPermission(state: string): DeviceCalendarPermission {
  switch (state) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      return 'prompt';
  }
}
