import type { Page } from '@playwright/test';

export interface SeededCalendar {
  readonly sourceId: string;
  readonly calendarId: string;
}

/** The shape of `@capacitor-community/sqlite`'s low-level calls this needs. */
interface SqlitePluginLike {
  run(options: {
    readonly database: string;
    readonly statement: string;
    readonly values: readonly unknown[];
    readonly transaction: boolean;
  }): Promise<unknown>;
  saveToStore(options: { readonly database: string }): Promise<unknown>;
}

/** Must match `DATABASE_NAME` in `src/app/data/gateways/sqlite.gateway.ts`. */
const DATABASE_NAME = 'rebellinnen-kalender';

/**
 * Seeds one writable app calendar straight into the SQLite database, bypassing the UI.
 *
 * `Kalender verwalten` (issue #20) has no screen yet to add an app calendar — it is still a stub
 * — so the appointment create/edit form's calendar picker has nothing to offer without this, and
 * every save is blocked by its `required` validator. This writes through
 * `window.Capacitor.Plugins.CapacitorSQLite`, the very plugin singleton `SqliteGateway` calls on
 * the web (`src/app/data/gateways/capacitor-sqlite.ts`), so it lands in the app's own open
 * connection rather than a second one.
 *
 * Ends on `/today`, having proven the database round-trips before writing to it — see
 * {@link ensureDatabaseReady}. Callers navigate on from there.
 */
export async function seedAppCalendar(page: Page, name = 'Testkalender'): Promise<SeededCalendar> {
  await ensureDatabaseReady(page);

  return page.evaluate(
    async ({ calendarName, databaseName }) => {
      const plugin = (
        window as unknown as { Capacitor: { Plugins: { CapacitorSQLite: SqlitePluginLike } } }
      ).Capacitor.Plugins.CapacitorSQLite;
      const now = new Date().toISOString();
      const sourceId = `e2e-source-${crypto.randomUUID()}`;
      const calendarId = `e2e-calendar-${crypto.randomUUID()}`;

      // `transaction: false`: `SqliteGateway` keeps its own BEGIN/COMMIT bookkeeping for the
      // single shared connection (see the "Serializes statements..." note there), and a call made
      // straight to the plugin runs outside that bookkeeping entirely. Letting the plugin wrap
      // these in its own transaction would race a concurrent `transaction()` call from the app for
      // the connection's one "transaction active" flag; a plain autocommit statement does not.
      await plugin.run({
        database: databaseName,
        statement:
          'INSERT INTO calendar_sources (id, type, name, enabled, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        values: [sourceId, 'app', calendarName, 1, 'ok', now, now],
        transaction: false,
      });
      await plugin.run({
        database: databaseName,
        statement:
          'INSERT INTO calendars (id, source_id, name, color, emoji, enabled, writable, external_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        values: [calendarId, sourceId, calendarName, '#5b8c5a', null, 1, 1, null, now, now],
        transaction: false,
      });

      // Without `autoSave` (see `web-sqlite-store.ts` for why it is off), nothing persists these
      // rows to IndexedDB on its own — `SqliteGateway` normally does that itself after a write. A
      // caller navigating on with `page.goto()` is a full browser navigation, not an in-app route
      // change, so it reloads the connection from IndexedDB and would otherwise lose this seed.
      await plugin.saveToStore({ database: databaseName });

      return { sourceId, calendarId };
    },
    { calendarName: name, databaseName: DATABASE_NAME },
  );
}

export interface SeedOccurrenceOptions {
  /**
   * For a real, editable app appointment prefer the actual create flow (`seedAppCalendar` plus the
   * "Neuer Termin" form) — this is for rendering a read-only or native-editable detail view where
   * the underlying data never needs to be genuinely editable, only shaped like each source type.
   */
  readonly sourceType: 'app' | 'device' | 'ics';
  /** Only meaningful for `device`: a writable device calendar offers "edit via native calendar". */
  readonly calendarWritable?: boolean;
  readonly title?: string;
  /** Device-local day (`YYYY-MM-DD`) the occurrence should be bucketed under. */
  readonly day?: string;
  /**
   * `app` only: gives the occurrence a `seriesId`/`originalStart`, which is what
   * `EventDetailPage.confirmDelete()`/`handleSave()` check to decide whether to ask
   * `RecurrenceScopeDialog` first. Renders and opens that dialog correctly; a full scoped
   * edit/delete through it is out of scope here (`app_items.rrule` is left `null`).
   */
  readonly recurring?: boolean;
}

export interface SeededOccurrence {
  readonly occurrenceId: string;
  readonly sourceId: string;
  readonly calendarId: string;
}

/**
 * Seeds one read-only occurrence — a device or an ICS one — straight into the `occurrences` table.
 *
 * There is no way to reach either through the UI at all: device sync needs a real OS calendar
 * (unavailable on web/CI) and ICS subscriptions are issue #21. `occurrences` is documented as a
 * disposable, derived cache with no foreign keys (`005-create-occurrences.ts`), which is exactly
 * what makes writing a row directly safe — nothing here needs to look like real recurrence-engine
 * output, only like a row `capabilitiesFor()` (`src/app/data/calendar/source-capabilities.ts`)
 * reads the same way a real one would.
 */
export async function seedOccurrence(
  page: Page,
  options: SeedOccurrenceOptions,
): Promise<SeededOccurrence> {
  await ensureDatabaseReady(page);

  const title = options.title ?? 'Gelesener Termin';
  const day = options.day ?? '2026-09-01';
  const writable = options.calendarWritable ?? false;
  const recurring = options.recurring ?? false;

  return page.evaluate(
    async ({
      sourceType,
      calendarWritable,
      title: occurrenceTitle,
      day: localDay,
      databaseName,
      recurring: isRecurring,
    }) => {
      const plugin = (
        window as unknown as { Capacitor: { Plugins: { CapacitorSQLite: SqlitePluginLike } } }
      ).Capacitor.Plugins.CapacitorSQLite;
      const now = new Date().toISOString();
      const sourceId = `e2e-source-${crypto.randomUUID()}`;
      const calendarId = `e2e-calendar-${crypto.randomUUID()}`;
      const startUtc = new Date(`${localDay}T00:00:00.000Z`).toISOString();
      const endUtc = new Date(`${localDay}T00:00:00.000Z`);
      endUtc.setUTCDate(endUtc.getUTCDate() + 1);

      const run = (statement: string, values: readonly unknown[]) =>
        plugin.run({ database: databaseName, statement, values, transaction: false });

      const sourceName =
        sourceType === 'app' ? 'App' : sourceType === 'device' ? 'Gerätekalender' : 'ICS-Kalender';
      const provenance = sourceType === 'app' ? 'standalone' : 'device-cached';
      const endDay = endUtc.toISOString().slice(0, 10);
      // Only an `app` occurrence has a canonical `app_items` row behind it; a `null` `item_id`
      // makes the detail page's edit/delete handlers no-op (`occurrence.itemId === null` is their
      // guard against exactly a missing item), so a real id is needed to exercise those flows.
      const itemId = sourceType === 'app' ? `e2e-item-${crypto.randomUUID()}` : null;
      // A standalone app occurrence's id must be exactly `app:${itemId}` — that is the convention
      // `standaloneRow()` (`occurrence-materializer.ts`) uses, and edit/delete rewrite the row by
      // deleting exactly that id (`CalendarRepository.deleteItem`/`updateItem`) before reinserting
      // it; a mismatched id would leave a stale row an edit or delete cannot ever touch.
      const occurrenceId = itemId !== null ? `app:${itemId}` : `e2e-occ-${crypto.randomUUID()}`;

      await run(
        'INSERT INTO calendar_sources (id, type, name, enabled, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sourceId, sourceType, sourceName, 1, 'ok', now, now],
      );
      await run(
        'INSERT INTO calendars (id, source_id, name, color, emoji, enabled, writable, external_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          calendarId,
          sourceId,
          sourceName,
          '#2f6f8f',
          null,
          1,
          calendarWritable ? 1 : 0,
          sourceType === 'device' ? `device-cal-${calendarId}` : null,
          now,
          now,
        ],
      );
      if (itemId !== null) {
        await run(
          `INSERT INTO app_items (
             id, calendar_id, kind, title, location, note, start_kind, start_value, start_tz,
             end_kind, end_value, end_tz, rrule, predecessor_series_id, rule_revision, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            calendarId,
            'event',
            occurrenceTitle,
            null,
            null,
            'date',
            localDay,
            null,
            'date',
            endDay,
            null,
            null,
            null,
            0,
            now,
            now,
          ],
        );
      }
      await run(
        `INSERT INTO occurrences (
           id, source_id, source_type, calendar_id, series_id, original_start, provenance,
           item_kind, item_id, title, location, is_all_day, start_kind, start_value, start_tz,
           end_kind, end_value, end_tz, start_utc, end_utc, start_local_day, end_local_day, external_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          occurrenceId,
          sourceId,
          sourceType,
          calendarId,
          isRecurring && itemId !== null ? itemId : null,
          isRecurring ? localDay : null,
          provenance,
          'event',
          itemId,
          occurrenceTitle,
          null,
          1,
          'date',
          localDay,
          null,
          'date',
          endDay,
          null,
          startUtc,
          endUtc.toISOString(),
          localDay,
          localDay,
          sourceType === 'device' ? `device-event-${occurrenceId}` : null,
        ],
      );

      await plugin.saveToStore({ database: databaseName });

      return { occurrenceId, sourceId, calendarId };
    },
    {
      sourceType: options.sourceType,
      calendarWritable: writable,
      title,
      day,
      databaseName: DATABASE_NAME,
      recurring,
    },
  );
}

/**
 * Proves `SqliteGateway`'s connection is open, migrated and idle before anything writes to it
 * straight through the plugin.
 *
 * Nothing on `/calendar` says this reliably: its empty-state text ("Keine Termine an diesem Tag.")
 * is the occurrences resource's *initial* value, rendered before the query resolves, not after —
 * so waiting for it proves nothing about the database. A round trip through the „Nicht vergessen“
 * list does: adding an entry and seeing it rendered can only happen once a write has gone through
 * the same connection and come back out again, and reminders.spec.ts already leans on that flow
 * being reliable. Racing a raw plugin call against the app's own still-in-flight `open()` sequence
 * is what produces "Datenbank konnte nicht geöffnet werden" and "no transaction is active" — this
 * sidesteps that by waiting for the app to reach a *provably* idle, already-open connection first.
 */
async function ensureDatabaseReady(page: Page): Promise<void> {
  await page.goto('/today');
  const marker = `e2e-db-warmup-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const field = page.getByLabel('Neue Erinnerung');
  if (!(await field.isVisible())) {
    await page.getByRole('button', { name: 'Punkt hinzufügen' }).click();
  }
  await field.fill(marker);
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.locator('ul.rk-list > li').filter({ hasText: marker }).waitFor({ state: 'visible' });
}
