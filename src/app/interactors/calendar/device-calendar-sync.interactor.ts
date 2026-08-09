import { inject, Injectable } from '@angular/core';
import { Temporal } from 'temporal-polyfill';

import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import {
  WINDOW_FUTURE_MONTHS,
  WINDOW_PAST_MONTHS,
} from '@app/data/calendar/recurrence/materialization-config';
import {
  NativeCalendarGateway,
  type DeviceCalendarPermission,
} from '@app/data/gateways/native-calendar.gateway';
import { devicePlatform } from '@app/cross-cutting/infrastructure/device-platform';

/** The one device source; a device has one OS calendar store, so the id is a constant. */
export const DEVICE_SOURCE_ID = 'device';

/** Automatic refreshes back off; an explicit user refresh never does. */
export const DEVICE_REFRESH_MIN_INTERVAL_MS = 60_000;

/** The fetch range gets a day of buffer on both sides so zone skew cannot clip multi-day events. */
const RANGE_BUFFER_DAYS = 1;

/**
 * Keeps the offline cache of the device calendars fresh.
 *
 * The OS stays authoritative: this interactor only decides *when* to read (connect, app
 * foreground, calendar screen, explicit refresh) and hands the result to the repository, which
 * swaps the affected range transactionally. Permission loss and native failures flag the source
 * and keep the cached rows — stale data beats an empty calendar offline.
 */
@Injectable({ providedIn: 'root' })
export class DeviceCalendarSyncInteractor {
  private readonly repository = inject(CalendarRepository);
  private readonly gateway = inject(NativeCalendarGateway);

  private lastAutomaticRefreshAt = 0;

  /** The user-initiated connection: asks for access and, when granted, loads the first cache. */
  async connect(): Promise<DeviceCalendarPermission> {
    const permission = await this.gateway.requestReadAccess();
    if (permission === 'granted') {
      await this.refresh({ force: true });
    }

    return permission;
  }

  /**
   * Refreshes the cached range. Automatic triggers (app foreground, screen activation) call this
   * without `force` and are debounced; pull-to-refresh passes `force: true`.
   */
  async refresh(options: { force?: boolean } = {}): Promise<void> {
    const now = Date.now();
    if (options.force !== true) {
      if (now - this.lastAutomaticRefreshAt < DEVICE_REFRESH_MIN_INTERVAL_MS) {
        return;
      }
      this.lastAutomaticRefreshAt = now;
    }

    const context = this.context();
    const source = await this.repository.findSource(DEVICE_SOURCE_ID);
    if (source === null) {
      return;
    }

    const permission = await this.gateway.checkReadPermission();
    if (permission !== 'granted') {
      // Access revoked: keep the cache, flag the source; the user decides what happens next.
      await this.repository.setSourceState(DEVICE_SOURCE_ID, 'permission-lost', context);
      return;
    }

    const range = await this.fetchRange(context);
    try {
      const calendars = await this.gateway.listCalendars();
      const instances = await this.gateway.listEventInstances(range.startUtc, range.endUtc);
      await this.repository.replaceDeviceRange(
        DEVICE_SOURCE_ID,
        devicePlatform(),
        range.startUtc,
        range.endUtc,
        calendars,
        instances,
        context,
      );
    } catch {
      // The native query failed; the previous cache stays and the source shows as failing.
      await this.repository.setSourceState(DEVICE_SOURCE_ID, 'error', context);
    }
  }

  /**
   * Hands a writable device event to the OS calendar's own edit prompt, then refreshes the cache so
   * whatever the user changed there shows up without waiting for the next automatic refresh.
   *
   * The gateway stays behind this interactor rather than being injected into the detail page
   * directly, per the architecture's boundary that keeps plugin access out of views.
   */
  async openForEditing(eventId: string): Promise<void> {
    await this.gateway.openEventForEditing(eventId);
    await this.refresh({ force: true });
  }

  /** Creates the device source on first connect; safe to call again. */
  async ensureSource(): Promise<void> {
    const existing = await this.repository.findSource(DEVICE_SOURCE_ID);
    if (existing !== null) {
      return;
    }

    const context = this.context();
    await this.repository.createSource(
      {
        id: DEVICE_SOURCE_ID,
        type: 'device',
        name: 'Gerätekalender',
        enabled: true,
        state: 'ok',
        createdAt: context.nowUtc,
        updatedAt: context.nowUtc,
      },
      [],
    );
  }

  /** The covered range extended by the buffer, or the default window for a first fetch. */
  private async fetchRange(
    context: CalendarContext,
  ): Promise<{ startUtc: string; endUtc: string }> {
    const coverage = await this.repository.findCoverage(DEVICE_SOURCE_ID);
    if (coverage !== null) {
      return {
        startUtc: addDays(coverage.windowStartUtc, -RANGE_BUFFER_DAYS),
        endUtc: addDays(coverage.windowEndUtc, RANGE_BUFFER_DAYS),
      };
    }

    const now = Temporal.Instant.from(context.nowUtc).toZonedDateTimeISO(context.timeZone);
    return {
      startUtc: now
        .subtract({ months: WINDOW_PAST_MONTHS, days: RANGE_BUFFER_DAYS })
        .toInstant()
        .toString(),
      endUtc: now
        .add({ months: WINDOW_FUTURE_MONTHS, days: RANGE_BUFFER_DAYS })
        .toInstant()
        .toString(),
    };
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

function addDays(instantIso: string, days: number): string {
  return Temporal.Instant.from(instantIso)
    .add({ hours: days * 24 })
    .toString();
}
