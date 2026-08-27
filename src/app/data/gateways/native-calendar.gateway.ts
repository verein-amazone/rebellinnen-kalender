import { inject, Injectable } from '@angular/core';
import { CalendarPermissionScope } from '@ebarooni/capacitor-calendar';

import { utcInstantFromEpochMilliseconds } from '../calendar/utc-instant';
import { CAPACITOR_CALENDAR } from './capacitor-calendar';

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
  readonly endUtc: string;
  readonly isAllDay: boolean;
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

/** Minutes before an event's start that `createEvent` sets a native alert for. */
const DEFAULT_ALERT_MINUTES_BEFORE_START = 15;

/**
 * The device calendar boundary - the only importer of `@ebarooni/capacitor-calendar`.
 *
 * iOS EventKit and the Android Calendar Provider stay authoritative; this gateway only reads.
 * Instances are translated to plugin-free shapes here, including the platform difference that iOS
 * repeats one event id for every instance of a series while Android instances carry their own
 * times - which is why identity above this gateway always includes the occurrence start.
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
      // `source` is iOS-only; Android has no separate id and reports `accountName` instead.
      sourceId: calendar.source?.id ?? calendar.accountName ?? null,
      sourceName: calendar.source?.title ?? calendar.accountName ?? null,
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
      description: event.description,
      startUtc: utcInstantFromEpochMilliseconds(event.startDate),
      endUtc: utcInstantFromEpochMilliseconds(event.endDate),
      isAllDay: event.isAllDay,
      timeZone: event.timezone,
    }));
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
   * Sets one native alert `DEFAULT_ALERT_MINUTES_BEFORE_START` before the start - negative minutes
   * mean "before" in the plugin's convention - so an appointment created here behaves like one
   * created directly in the OS calendar app, which always gets a default reminder. There is no form
   * field for this yet; it is a fixed default until one exists.
   */
  async createEvent(draft: DeviceEventDraft): Promise<{ eventId: string }> {
    const { id } = await this.plugin.createEvent({
      calendarId: draft.calendarId,
      title: draft.title,
      location: draft.location ?? undefined,
      startDate: Date.parse(draft.startUtc),
      endDate: Date.parse(draft.endUtc),
      isAllDay: draft.isAllDay,
      alerts: draft.isAllDay ? undefined : [-DEFAULT_ALERT_MINUTES_BEFORE_START],
    });
    return { eventId: id };
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
