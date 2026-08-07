import { inject, Injectable } from '@angular/core';
import { CalendarPermissionScope } from '@ebarooni/capacitor-calendar';

import { utcInstantFromEpochMilliseconds } from '../calendar/utc-instant';
import { CAPACITOR_CALENDAR } from './capacitor-calendar';

/** The read permission as the app reasons about it — no plugin types above this line. */
export type DeviceCalendarPermission = 'granted' | 'denied' | 'prompt';

/** One calendar as the operating system reports it. */
export interface DeviceCalendar {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly writable: boolean;
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
  readonly startUtc: string;
  readonly endUtc: string;
  readonly isAllDay: boolean;
  readonly timeZone: string | null;
}

/**
 * The device calendar boundary — the only importer of `@ebarooni/capacitor-calendar`.
 *
 * iOS EventKit and the Android Calendar Provider stay authoritative; this gateway only reads.
 * Instances are translated to plugin-free shapes here, including the platform difference that iOS
 * repeats one event id for every instance of a series while Android instances carry their own
 * times — which is why identity above this gateway always includes the occurrence start.
 */
@Injectable({ providedIn: 'root' })
export class NativeCalendarGateway {
  private readonly plugin = inject(CAPACITOR_CALENDAR);

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
      name: calendar.title,
      color: calendar.color ?? null,
      writable: calendar.allowsContentModifications ?? false,
    }));
  }

  /** The concrete instances overlapping the range, multi-day events included. */
  async listEventInstances(fromUtc: string, toUtc: string): Promise<DeviceEventInstance[]> {
    const { result } = await this.plugin.listEventsInRange({
      from: Date.parse(fromUtc),
      to: Date.parse(toUtc),
    });

    return result.map((event) => ({
      eventId: event.id,
      calendarId: event.calendarId,
      title: event.title,
      location: event.location,
      startUtc: utcInstantFromEpochMilliseconds(event.startDate),
      endUtc: utcInstantFromEpochMilliseconds(event.endDate),
      isAllDay: event.isAllDay,
      timeZone: event.timezone,
    }));
  }
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
