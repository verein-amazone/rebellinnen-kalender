import { inject, Injectable } from '@angular/core';

import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import type { CalendarSourceRecord } from '@app/data/entities/calendar-source.record';
import { AppSettingsGateway } from '@app/data/gateways/app-settings.gateway';
import { EmojiPickerGateway } from '@app/data/gateways/emoji-picker.gateway';
import type { DeviceCalendarPermission } from '@app/data/gateways/native-calendar.gateway';

import { DEVICE_SOURCE_ID, DeviceCalendarSyncInteractor } from './device-calendar-sync.interactor';

// Views describe permission through the interactor's type; the gateway is the data layer's boundary.
export type { DeviceCalendarPermission } from '@app/data/gateways/native-calendar.gateway';

/** One device calendar as the management screen lists it. */
export interface DeviceCalendarRow {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly enabled: boolean;
  readonly writable: boolean;
}

/**
 * The calendars of one native account/source (iCloud, a Google account, Exchange, …), the
 * management screen's subheading grouping. `nativeSourceId` is `null` when the platform reported
 * no account for any calendar in the group - the calendars still need somewhere to render.
 */
export interface DeviceCalendarGroup {
  readonly nativeSourceId: string | null;
  readonly nativeSourceName: string | null;
  readonly calendars: readonly DeviceCalendarRow[];
  /** Whether every calendar in the group is enabled - the group's own "select all" state. */
  readonly allEnabled: boolean;
}

/** The device source's connection state plus its calendars, for the „Kalender verwalten“ screen. */
export interface DeviceCalendarsSnapshot {
  readonly source: CalendarSourceRecord | null;
  readonly groups: readonly DeviceCalendarGroup[];
}

/**
 * The calendar-management screen's data source for the device-calendars section: connecting,
 * listing (grouped by native account/source), enabling/disabling individual calendars or a whole
 * account's worth at once, and disconnecting. Permission and cache refreshing stay
 * `DeviceCalendarSyncInteractor`'s job - this interactor delegates to it rather than duplicating
 * that flow.
 */
@Injectable({ providedIn: 'root' })
export class DeviceCalendarsInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly sync = inject(DeviceCalendarSyncInteractor);
  private readonly appSettings = inject(AppSettingsGateway);
  private readonly emojiPicker = inject(EmojiPickerGateway);

  /** The device source's state and its calendars grouped by native account/source. */
  async loadSnapshot(): Promise<DeviceCalendarsSnapshot> {
    const source = await this.repository.findSource(DEVICE_SOURCE_ID);
    if (source === null) {
      return { source: null, groups: [] };
    }

    const calendars = await this.repository.listCalendarsOfSource(DEVICE_SOURCE_ID);
    const groups = new Map<
      string,
      {
        nativeSourceId: string | null;
        nativeSourceName: string | null;
        calendars: DeviceCalendarRow[];
      }
    >();

    for (const calendar of calendars) {
      // Grouped by id, not name: two different accounts can share a display name. Calendars the
      // platform reported with no account at all share one fallback bucket, keyed by `''` since
      // `nativeSourceId` itself is `null` for all of them.
      const key = calendar.nativeSourceId ?? '';
      const group = groups.get(key) ?? {
        nativeSourceId: calendar.nativeSourceId,
        nativeSourceName: calendar.nativeSourceName,
        calendars: [],
      };
      group.calendars.push({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        emoji: calendar.emoji,
        enabled: calendar.enabled,
        writable: calendar.writable,
      });
      groups.set(key, group);
    }

    return {
      source,
      groups: [...groups.values()].map((group) => ({
        ...group,
        allEnabled: group.calendars.every((calendar) => calendar.enabled),
      })),
    };
  }

  /** The user-initiated connection: requests permission and, when granted, loads the first cache. */
  connect(): Promise<DeviceCalendarPermission> {
    return this.sync.connect();
  }

  /**
   * The permission-recovery deep link: the app cannot re-request a denied or revoked permission on
   * its own, so this sends the user to the OS settings screen that grants it.
   */
  openAppSettings(): Promise<void> {
    return this.appSettings.openAppSettings();
  }

  /** Shows or hides one device calendar's occurrences without touching the connection itself. */
  async setCalendarEnabled(calendarId: string, enabled: boolean): Promise<void> {
    await this.repository.setCalendarEnabled(calendarId, enabled, this.context());
  }

  /**
   * Changes one device calendar's emoji. The device never reports an emoji of its own, so this is
   * the only way a device calendar gets one - unlike its name/colour, which come from the OS.
   */
  async setCalendarEmoji(calendarId: string, emoji: string): Promise<void> {
    await this.repository.setCalendarEmoji(calendarId, emoji, this.context());
  }

  /** Opens the emoji picker; resolves `null` when the user dismisses it without a selection. */
  pickEmoji(): Promise<string | null> {
    return this.emojiPicker.pickEmoji();
  }

  /** The management screen's per-account "select all" toggle. */
  async setCalendarsEnabledByNativeSource(
    nativeSourceId: string | null,
    enabled: boolean,
  ): Promise<void> {
    await this.repository.setCalendarsEnabledByNativeSource(
      DEVICE_SOURCE_ID,
      nativeSourceId,
      enabled,
      this.context(),
    );
  }

  /**
   * Opts out of the device source locally. This cannot revoke the OS permission - only the system
   * settings can - so the app keeps the cached rows around, disabled, until the user connects again.
   */
  async disconnect(): Promise<void> {
    await this.repository.disconnectDeviceSource(DEVICE_SOURCE_ID, this.context());
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
