import { inject, Injectable } from '@angular/core';

import { CalendarRepository } from '@app/data/calendar/calendar.repository';
import { CalendarSourceDao } from '@app/data/daos/calendar-source.dao';

/** A calendar the create/edit form's picker may offer, stripped of everything view-irrelevant. */
export interface WritableAppCalendar {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

/**
 * The calendar picker's data source for creating and editing app-owned events and todos.
 *
 * App calendars are always writable — capabilities follow ownership (see `source-capabilities.ts`)
 * and every `app`-type source is app-owned — so this only ever filters by source type. This is the
 * only interactor the picker may use; views must never inject `CalendarSourceDao` directly.
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

    const appSourceIds = new Set(
      sources.filter((source) => source.type === 'app').map((source) => source.id),
    );

    return calendars
      .filter((calendar) => appSourceIds.has(calendar.sourceId))
      .map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        emoji: calendar.emoji,
      }));
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
          createdAt: now,
          updatedAt: now,
        },
      ],
    );
  }
}
