import { inject, Injectable } from '@angular/core';

import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import { shiftEnd } from '@app/data/calendar/recurrence/occurrence-materializer';
import { toUtcInstantString, withoutEndBound } from '@app/data/calendar/recurrence/rrule-tools';
import type {
  AppItemExceptionRecord,
  AppItemKind,
  AppItemRecord,
} from '@app/data/entities/app-item.record';
import type { TemporalValue } from '@app/data/entities/temporal-value';
import { NativeCalendarGateway } from '@app/data/gateways/native-calendar.gateway';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';

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
}

/** A partial edit; absent fields keep their current value. */
export interface AppEventChanges {
  readonly title?: string;
  readonly location?: string | null;
  readonly note?: string | null;
  readonly start?: TemporalValue;
  readonly end?: TemporalValue | null;
  readonly rrule?: string | null;
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

  /**
   * The full canonical record behind an item, for a consumer that needs a field the read-model
   * (`CalendarOccurrence`) does not carry — currently the note, for the detail page's read view and
   * its edit-mode prefill. Kept here rather than exposing `CalendarRepository` to views, per the
   * architecture's DAO/repository-injection boundary.
   */
  findRecord(itemId: string): Promise<AppItemRecord | null> {
    return this.repository.findItem(itemId);
  }

  /**
   * Creates a standalone item or a new series and returns its id — unless `calendarId` names a
   * writable device calendar, in which case the appointment is written straight into the OS
   * calendar via `createDeviceEvent` instead. `EventForm` never sets `rrule` on a draft, so a
   * device destination never has to represent recurrence the plugin write does not accept.
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
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    };

    await this.repository.createItem(record, context);
    return record.id;
  }

  /**
   * Writes a standalone event directly into the OS calendar and refreshes the device cache so it
   * appears immediately, instead of waiting for the next automatic sync. No canonical app row is
   * created — the OS is the record from the start, the same as any other device event.
   */
  private async createDeviceEvent(nativeCalendarId: string, draft: AppEventDraft): Promise<string> {
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const isAllDay = draft.start.kind === 'date';
    const startUtc = toUtcInstantString(draft.start, deviceZone);
    const endUtc = toUtcInstantString(draft.end ?? draft.start, deviceZone);

    const { eventId } = await this.nativeCalendar.createEvent({
      calendarId: nativeCalendarId,
      title: validatedTitle(draft.title),
      location: draft.location,
      startUtc,
      endUtc,
      isAllDay,
    });

    await this.deviceSync.refresh({ force: true });
    return eventId;
  }

  /** Edits a standalone item, or every occurrence of a series. */
  async updateAll(itemId: string, changes: AppEventChanges): Promise<void> {
    const context = this.context();
    const item = await this.repository.findItem(itemId);
    if (item === null) {
      return;
    }

    const patternChanged =
      (changes.rrule !== undefined && changes.rrule !== item.rrule) ||
      (changes.start !== undefined && changes.start.value !== item.start.value);

    await this.repository.updateItem(
      {
        ...item,
        title: changes.title !== undefined ? validatedTitle(changes.title) : item.title,
        location: changes.location !== undefined ? changes.location : item.location,
        note: changes.note !== undefined ? changes.note : item.note,
        start: changes.start ?? item.start,
        end: changes.end !== undefined ? changes.end : item.end,
        rrule: changes.rrule !== undefined ? changes.rrule : item.rrule,
        ruleRevision: patternChanged ? item.ruleRevision + 1 : item.ruleRevision,
        updatedAt: context.nowUtc,
      },
      context,
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

    const start: TemporalValue = changes.start ?? {
      kind: master.start.kind,
      value: originalStart,
      timeZone: master.start.timeZone,
    };
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
      // COUNT and UNTIL do not carry over: the continuation is a fresh series from the split on.
      rrule: changes.rrule !== undefined ? changes.rrule : withoutEndBound(master.rrule),
      predecessorSeriesId: seriesId,
      ruleRevision: 0,
      createdAt: context.nowUtc,
      updatedAt: context.nowUtc,
    };

    await this.repository.splitSeries(seriesId, originalStart, continuation, context);
  }

  /** Deletes this and all following occurrences by ending the series before the selected one. */
  async deleteFollowing(seriesId: string, originalStart: string): Promise<void> {
    await this.repository.deleteFollowing(seriesId, originalStart, this.context());
  }

  /** Deletes a standalone item or an entire series. */
  async deleteItem(itemId: string): Promise<void> {
    await this.repository.deleteItem(itemId);
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

function validatedTitle(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > APP_EVENT_TITLE_MAX_LENGTH) {
    throw new AppEventTitleInvalidError();
  }

  return trimmed;
}
