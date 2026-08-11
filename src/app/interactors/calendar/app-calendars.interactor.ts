import { inject, Injectable } from '@angular/core';

import { CalendarRepository, type CalendarContext } from '@app/data/calendar/calendar.repository';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';

/**
 * A calendar the create/edit form's picker may offer, stripped of everything view-irrelevant.
 * `sourceType` defaults to `'app'` when absent, which every fixture predating device calendars in
 * the picker relies on.
 */
export interface WritableAppCalendar {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
  readonly sourceType?: 'app' | 'device';
}

/**
 * The calendar picker's data source for creating and editing app-owned events and todos.
 *
 * Writable calendars come from two source types: the app's own calendars, always writable because
 * capabilities follow ownership (see `source-capabilities.ts`), and enabled, writable device
 * calendars — a create writes straight into the OS calendar (see
 * `AppEventEditingInteractor.create`), never a canonical app record. This is the only interactor
 * the picker may use; views must never inject `CalendarSourceDao` directly.
 */
@Injectable({ providedIn: 'root' })
export class AppCalendarsInteractor {
  private readonly sources = inject(CalendarSourceDao);
  private readonly repository = inject(CalendarRepository);

  /**
   * Lists the picker's choices, first creating the app's own calendar source if none exists yet —
   * so a fresh install never shows an empty picker. This runs here rather than from an app
   * initializer: a `provideAppInitializer` write races the SQLite plugin's own startup and can hang
   * bootstrap before the plugin is ready to accept queries, where a component-triggered read/write
   * like this one only ever runs once the app (and the plugin) is already up.
   */
  async listWritable(): Promise<WritableAppCalendar[]> {
    await this.ensureDefault();

    const [sources, calendars] = await Promise.all([
      this.sources.listSources(),
      this.sources.listCalendars(),
    ]);

    const sourceTypeById = new Map(sources.map((source) => [source.id, source.type]));
    const enabledSourceIds = new Set(
      sources.filter((source) => source.enabled).map((source) => source.id),
    );

    return calendars
      .filter((calendar) => {
        const sourceType = sourceTypeById.get(calendar.sourceId);
        if (sourceType === 'app') {
          return true;
        }
        return (
          sourceType === 'device' &&
          calendar.writable &&
          calendar.enabled &&
          enabledSourceIds.has(calendar.sourceId)
        );
      })
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        emoji: calendar.emoji,
        sourceType: sourceTypeById.get(calendar.sourceId) as 'app' | 'device',
      }));
  }

  /** Renames the app calendar or changes its colour/emoji identity. */
  async updateIdentity(
    calendarId: string,
    identity: { name: string; color: string | null; emoji: string | null },
  ): Promise<void> {
    await this.repository.updateCalendarIdentity(calendarId, identity, this.context());
  }

  /** Creates the app's own calendar source on first run. A no-op once an app source exists. */
  private async ensureDefault(): Promise<void> {
    const sources = await this.sources.listSources();
    if (sources.some((source) => source.type === 'app')) {
      return;
    }

    const sourceId = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.repository.createSource(
      {
        id: sourceId,
        type: 'app',
        name: 'Mein Kalender',
        enabled: true,
        state: 'ok',
        createdAt: now,
        updatedAt: now,
      },
      [
        {
          id: crypto.randomUUID(),
          sourceId,
          name: 'Mein Kalender',
          color: null,
          emoji: null,
          enabled: true,
          writable: true,
          externalId: null,
          nativeSourceId: null,
          nativeSourceName: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    );
  }

  private context(): CalendarContext {
    return {
      nowUtc: new Date().toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
