# Data & persistence

This document describes how the app stores data and the conventions the data layer must follow. It
complements [frontend-architecture.md](./frontend-architecture.md).

> Status: the SQLite foundation exists (gateway with transactions, migration registry, DAOs), and
> the calendar data architecture (#29) is in place: canonical app items, the materialized occurrence
> layer, the native calendar gateway with its offline cache, and ICS subscriptions. The calendar
> screens consuming it are still outstanding.

## Local-only persistence

The app works **without login and without its own server infrastructure**. All application-owned
data is stored locally on the device. There is no backend, no cloud synchronization, and no
authentication.

## SQLite via `@capacitor-community/sqlite`

Relational, application-owned data is persisted in SQLite through
[`@capacitor-community/sqlite`](https://github.com/capacitor-community/sqlite), accessed behind DAOs
and versioned migrations.

### The database gateway

`data/gateways/sqlite.gateway.ts` is the only file that injects the plugin (the plugin object
itself is imported once in `cross-cutting/plugins/sqlite.plugin.ts` - see below). Everything above it
depends on the `SqliteDatabase` contract in `sqlite-database.ts` - `query()` and `run()`, plus a
`SqliteUnavailableError` and the `SQLITE_DATABASE` token DAOs inject. Two consequences worth knowing:

- **The connection opens lazily on first use, not from an app initializer.** Nothing in the first
  paint needs the database, and a database that cannot open has to surface as an error inside the
  screen that wanted it rather than aborting the bootstrap. The open promise is memoised so
  concurrent callers share one open sequence, and it is dropped on failure so a retry really retries.
- **The open sequence starts with `checkConnectionsConsistency()`.** The plugin keeps a connection
  dictionary that survives a dev-server reload; without this reconciliation `createConnection` fails
  after every HMR update.

The contract also exposes `transaction<T>(work)`: the callback receives a `SqliteExecutor` (the same
`query`/`run` surface) and everything issued through it commits together or not at all. The gateway
implements this with plain `BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK` statements - identical behaviour on
iOS, Android and `jeep-sqlite` - with the plugin's automatic per-statement transaction switched off
inside, and serializes statements and transactions on the single shared connection. Two rules follow:

- **Inside a `transaction()` callback, only the passed executor may be used.** Calling the database
  directly from within the callback would wait on the serialization lock the transaction holds.
- **On web, the IndexedDB store is written once per committed transaction**, never for a rolled-back
  one. A single `run()` outside a transaction still wraps itself and saves as before.

### SQLite in the browser

The app ships to iOS and Android only. The browser is used for `ng serve` and the Playwright suite,
and it gets **real** SQLite there: `data/gateways/web-sqlite-store.ts` lazily loads the `jeep-sqlite`
custom element (`sql.js` compiled to WebAssembly, persisted in IndexedDB) and calls `initWebStore()`,
and every successful write is followed by `saveToStore()`. That way the handwritten SQL and the
migrations that run on a phone are the same ones a developer clicks through.

Two things to keep in mind:

- `sql.js` is **not a direct dependency**. `jeep-sqlite` bundles the Emscripten glue of the release
  it was built against, and a newer `sql-wasm.wasm` next to that older glue fails to instantiate
  with a `LinkError`. pnpm hoists jeep-sqlite's own `sql.js` (`publicHoistPattern`) for the
  `angular.json` asset copy, and an override in `pnpm-workspace.yaml` keeps it on the newest
  version that actually links - currently 1.12.0, because jeep-sqlite's declared `^1.11.0` range
  wrongly admits 1.13+. Re-test on every jeep-sqlite upgrade (the reminders e2e specs catch a
  mismatch) and drop the override once upstream rebuilds its glue - tracked upstream in
  [jeep-sqlite#50](https://github.com/jepiqueau/jeep-sqlite/issues/50) (same `LinkError`, same
  override as the community fix) and
  [jeep-sqlite#52](https://github.com/jepiqueau/jeep-sqlite/issues/52) (sql.js 1.14 support).
  The actual exit path is
  [capacitor-community/sqlite#694](https://github.com/capacitor-community/sqlite/pull/694), which
  replaces the plugin's jeep-sqlite web implementation with `@sqlite.org/sqlite-wasm` + OPFS.
  When that ships: bump the plugin, remove the jeep-sqlite wiring in `web-sqlite-store.ts`, and
  delete the `publicHoistPattern`/`overrides` block plus the `sql-wasm.wasm` asset entry. (A
  repo-local fallback design for the same replacement - main-thread `kvvfs` behind the
  `SQLITE_DATABASE` token - was sketched on 2026-08-07 and can be built if #694 stalls for good.)
- `sql-wasm.wasm` is copied by **every** build (see `angular.json`). CI runs the e2e suite against
  the production bundle served statically, so the production web build must be able to open a
  database too. There is still no web product; the asset also ships in the native bundles, which is
  accepted for now.

### No ORM

We deliberately do not install an ORM or query builder:

- The SQLite plugin is fully open source and already familiar from Independo applications.
- Available ORM/query-builder adapters do not currently provide enough confidence for the selected
  Angular 22 and Capacitor 8 stack.
- A small application does not justify the additional abstraction and migration tooling.
- Handwritten SQL stays contained and testable inside the data layer.
- Interactors and views remain independent of the persistence implementation.

### The plugin caps the native Capacitor version

On iOS the plugin's own `Package.swift` declares its Capacitor dependency as
`.package(url: "…/capacitor-swift-pm.git", branch: "8.0.0")`. An unversioned Swift Package Manager
requirement wins over a versioned one for the **entire** dependency graph, so that branch overrides
the `exact: "8.5.0"` that `ios/App/CapApp-SPM/Package.swift` asks for. Three things follow:

- **`package.json` does not tell you which Capacitor the app links against.**
  `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` does, and it
  currently reads `branch: "8.0.0"`, revision `5962590`. Check that file, not the npm version.
- **Native APIs added after Capacitor iOS 8.0 are unavailable at compile time.** The concrete case is
  `SceneDelegateProxy` from [Capacitor 8.5](https://capacitorjs.com/docs/updating/8-5), which is why
  `ios/App/App/SceneDelegate.swift` is hand-written and forwards through `ApplicationDelegateProxy`
  instead. The legacy `capacitorOpenURL` / `capacitorOpenUniversalLink` notifications it posts are
  the ones plugins observe, so behaviour is equivalent.
- **Do not delete `Package.resolved` to force a re-resolve.** `refs/heads/8.0.0` no longer exists on
  `capacitor-swift-pm`; the pinned revision survives only because it is still reachable from `main`.
  A resolve without that file has no branch to follow and fails.

The way out is upstream, tracked in
[capacitor-community/sqlite#697](https://github.com/capacitor-community/sqlite/issues/697): when the
plugin publishes a version without the branch pin, take it, confirm
`Package.resolved` moves to 8.5.0 or later, and replace `SceneDelegate.swift` with the stock
implementation from the Capacitor 8.5 guide.

## DAOs

DAOs (`data/daos/*.dao.ts`) contain thin, table-oriented SQLite access:

- Parameterized SQL (never string-concatenated values).
- Insert, update and delete operations.
- Queries and row-to-record conversion where necessary.
- Optional transaction parameters.

DAOs **must not** contain business rules. The only places handwritten SQL should normally appear are
DAOs, database initialization, and migrations. Use the `*Dao` suffix consistently for direct
SQLite/table access.

A method that writes many rows issues **one statement per chunk, not one per row**: on a device
every statement is its own round trip through the Capacitor bridge, and a loop of them dominated
app start. Only placeholders are generated into the SQL - every value stays bound. Chunk sizes are
per table and deliberately conservative, because `SQLITE_MAX_VARIABLE_NUMBER` is 999 on older
builds and iOS, Android and `jeep-sqlite` do not all ship the same engine (see `INSERT_CHUNK_ROWS`
in `occurrence.dao.ts` for the reasoning, and `reminder.dao.ts` for the `CASE`-per-id update form).

## Migrations

All schema changes are **versioned migrations** under `data/migrations/`: one file per version
(`001-create-reminders.ts`), collected in `migrations.ts`, which also derives `DATABASE_VERSION` from
the highest `toVersion`. Never mutate an existing shipped migration - a device that already applied
it will not run it again, so the edit would only reach fresh installs and the two would drift apart.
Add a new migration instead.

Applying them is the plugin's job, not ours: the gateway hands the registry to
`addUpgradeStatement()` and asks `createConnection()` for `DATABASE_VERSION`. That mechanism is
supported on every platform, applies each upgrade in a transaction (with a backup on native), and
reports the same number through `getVersion()` - a hand-rolled `user_version` loop would duplicate
that bookkeeping and could disagree with it.

## Transaction boundaries

A single logical unit of work (for example, a multi-table write for one use case) runs inside one
`transaction()` call. Transaction control belongs at the boundary that represents the unit of work -
the service that coordinates several DAOs - not buried inside unrelated DAO methods. DAOs stay
transaction-agnostic: a DAO method takes an optional trailing `SqliteExecutor` parameter defaulting
to the injected database, so the same method works standalone and inside a transaction.

## Records, IDs and timestamps

Persisted record types live in `data/entities/*.record.ts`. Conventions for application-owned
records:

- Use **client-generated UUIDs** for application-owned records.
- Use **UTC timestamps** for persisted instants.
- Where date semantics matter, preserve the **local calendar date** separately from the instant.
- Persist **`createdAt`** and **`updatedAt`** for mutable application-owned records.
- Keep **external calendar identifiers separate** from application-owned identifiers.

`reminders`, the first table, follows these and adds one decision worth repeating: the completion
state is the `completed_at` timestamp alone (`NULL` means open). A second boolean column could
disagree with the timestamp, so there is none. The list is read in exactly one order -
`ORDER BY (completed_at IS NULL) DESC, position ASC, created_at ASC`, i.e. open entries first, each
section in the order the user arranged, with `created_at` only breaking a tie - and the table's only
index mirrors that.

### Manual order

`position` is a `REAL`, not an integer rank. Moving an entry between two others writes the midpoint of
their positions, so a reorder is a **single-row `UPDATE`** - and a single statement is already atomic,
which is why dragging a row does not need transaction support that does not exist. An entry entering a
section gets one step (1000) beyond the end it enters at.

Fractional positions can only be halved so many times before two doubles round to the same value. When
the gap between the neighbours falls below `1e-6` the interactor renumbers that section instead -
still in one statement, built as `SET position = CASE id WHEN ? THEN ? … END` by
`ReminderDao.reassignPositions`. Reaching that point takes roughly fifty drops into the same shrinking
gap; writing it as a loop of updates would have been the only part of the feature that could be
interrupted halfway.

Completing or reopening an entry moves it into the other section and therefore always writes a new
position with the same statement (`updateCompletion`): a half-applied move would order the entry by a
position belonging to the section it just left.

**Hiding completed entries at the day change is an interactor rule, not SQL.** `completed_at` is a UTC
instant while the cutoff is local midnight, and SQLite's `localtime` modifier resolves against the host
process' zone - which is not the same on the native plugin and in the `jeep-sqlite` build - and cannot
be bound as a parameter. It is also a product rule driven by a preference, and DAOs hold no business
rules. Hidden entries are only filtered out of the list; the rows stay in the database.

## The calendar data architecture

The calendar (#29) combines three source types behind one read model. The dependency chain is
`interactors/calendar/*` → `data/calendar/calendar.repository.ts` → DAOs, gateways and the
recurrence machinery. The repository is the calendar's unit-of-work boundary - the deliberate
exception to „repositories are not introduced automatically“: it coordinates several DAOs, the
recurrence engine, the native calendar gateway and the ICS pipeline, and every method that changes
derived rows runs inside one transaction.

### Authoritative, derived, disposable

- **Authoritative:** `calendar_sources` and app `calendars` (configuration); `app_items` and
  `app_item_exceptions` (canonical events/todos: a master, an optional RFC 5545 `RRULE`, and
  per-occurrence overrides or cancellations keyed by the occurrence's **original start**);
  `ics_subscriptions` (configuration plus the raw text and HTTP validators of the last valid
  download).
- **Derived but retained:** `ics_items`/`ics_item_exceptions` - the normalized form of the active
  ICS revision. Only a fully validated new revision may replace them; a failed refresh never
  touches them.
- **Derived and disposable:** `occurrences` and `source_coverage`. One row per concrete instance
  across all sources, always rebuildable from the authoritative or retained data (or a fresh
  native query), never the only representation of anything.

Start and end times are stored as a lossless temporal triple (`kind` ∈ `date | zoned | floating |
utc`, `value`, `tz`; see `data/entities/temporal-value.ts`), so a rule like „weekly at 18:00 in
Europe/Vienna“ survives DST and a birthday stays a date. Materialized rows additionally carry
computed `start_utc`/`end_utc` (end exclusive) and device-zone day columns; `date` and `floating`
rows are computed in the device zone at materialization time, which is legitimate because a zone
change triggers a rebuild (`CalendarMaintenanceInteractor`).

### Occurrence identity

Identity is always source-scoped: `app:<series>#<originalStart>`,
`ics:<subscription>:<uid>#<recurrenceId>`, `device:<platform>:<calendarId>:<eventId>#<start>`.
The original start is the identity of a series occurrence; its effective time can differ when an
override moved it. Identical UIDs from different sources can never collide.

### Materialization window

Expansion is bounded to a configurable window (defaults −6/+18 months,
`data/calendar/recurrence/materialization-config.ts`) and extended when a range query approaches a
coverage edge. Coverage rows are written in the same transaction as the rows they describe and are
stamped with the recurrence-engine version, so an engine upgrade triggers a cheap full rebuild of
derived rows without touching canonical data.

### Recognising work that would change nothing

Rebuilding derived rows is cheap to write but not free, and the two paths that run on every launch
would otherwise redo it in full each time:

- A coverage row also carries a **content fingerprint** of the external data its rows were built
  from (`data/calendar/device-cache-fingerprint.ts`). Only the device source has such input - app
  and ICS rows are materialized from canonical data already in the database, so the column stays
  `NULL` for them. A device refresh normalizes what the OS returned, fingerprints it, and skips the
  swap when it matches what is stored _and_ the row count still agrees. The fingerprint describes
  the input; the count confirms the output is still there. Either disagreeing rebuilds, which is
  the safe direction. There is no change token on either platform, so the instances still have to
  be fetched and normalized - what this avoids is rewriting the whole window.
- An ICS subscription records `last_checked_at` separately from `last_success_at`: a `304 Not
Modified` confirms the cached revision is current without storing a new one. The automatic
  refresh interval is measured against the check, so a feed that never changes stops being asked
  on every launch.

Writes that would restate what a row already says are skipped throughout the layer - coverage rows
included - because such a write is indistinguishable from no write to every reader, and re-stamping
one invalidates caches built on top of it.

## Plugin tokens - `cross-cutting/plugins/`

Every Capacitor plugin package is imported in exactly one file,
`cross-cutting/plugins/<capability>.plugin.ts`, which hands it on as an Angular `InjectionToken`.
Two layers inject such a token and no others: `data/gateways/**` for plugins that are a data source,
and `cross-cutting/infrastructure/**` for plugins that are a device capability. ESLint enforces both
the package ban and the token ban (specs excepted - substituting a token is what it is for).

The reason is testability. Most of these plugins have no web implementation, so under jsdom every
call rejects with `"<Plugin>.<method>() is not implemented on web"`, and a directly imported plugin
object leaves a spec no seam to replace it - not even a component spec that only happens to construct
the wrapper transitively. The folder also makes the native surface countable: those files are the
complete list of native capabilities the app depends on.
`src/app/cross-cutting/plugins/README.md` carries the detail, including why several tokens hold a
plain forwarding object rather than the plugin itself.

## Native calendar gateway boundary

The device calendar is read through `data/gateways/native-calendar.gateway.ts` wrapping
[`@ebarooni/capacitor-calendar`](https://github.com/ebarooni/capacitor-calendar) - the only file
injecting it. The gateway **prevents Capacitor plugin types from leaking** into interactors or
views. Permissions are only ever requested from the explicit „connect device calendars“ action,
never on startup.

## What is and is not stored in SQLite

Stored locally:

- The „Nicht vergessen“ list (`reminders`).
- App-owned events and content (canonical, editable in the app).
- Calendar sources, calendars, ICS subscriptions with their normalized items, and the materialized
  occurrence rows of all three source types.

About device calendar data specifically:

- The OS (EventKit / Calendar Provider) stays **authoritative**; device events are never stored as
  canonical app records and cached instances are never editable in the app.
- Concrete instances for the covered range **are cached** in the `occurrences` table as
  disposable, rebuildable rows for offline display, replaced transactionally per refreshed range.
  (This deliberately supersedes the earlier „queried on demand, never copied“ rule: offline views
  need the rows, and their disposability keeps the ownership story intact.)
- Losing calendar permission or a failing native query keeps the cache and flags the source
  (`permission-lost` / `error`) instead of emptying the calendar.

ICS subscription URLs may embed access tokens. They live only in `ics_subscriptions`, and every
log- or UI-facing string uses `redactIcsUrl()` (origin plus path tail). HTTPS is required unless a
subscription explicitly opts into `http`.

## Stores

`data/stores/*.store.ts` hold small persisted values that do not belong in a relational table - the
appearance preferences (`appearance.store.ts`) and the preferences of the „Nicht vergessen“ list
(`reminders.store.ts`). They persist to `localStorage`, which is available in both the iOS and Android
WebViews, survives restarts, and avoids paying the SQLite connection cost for a handful of scalars read
on every startup.

`reminders.store.ts` is the one to look at for the boundary: it holds where a new or completed entry
enters its section and whether completed entries disappear at the day change - three scalars. The
entries themselves stay in SQLite.

Stores expose their state as signals and **validate on read**: a stored value may come from an older
app version or from a manually edited storage entry, so an unrecognised value falls back to the
documented default instead of reaching the rest of the app.

`localStorage` access throws in some privacy modes, so it is never touched directly - reads and
writes are guarded, and a lost preference is preferable to a broken app.

A store is **not** where a table-backed list belongs. The screen that shows one holds it in a
`resource()` and reloads after each write (see
[frontend-architecture.md](./frontend-architecture.md)); interactors stay stateless. When a second
consumer of the same list appears, that cache can be promoted into the data layer - and this
document amended.

## Future synchronization

The design keeps future sync possible through clean boundaries and stable IDs (client-generated
UUIDs, separated external identifiers). We deliberately do **not** implement synchronization
infrastructure now - no sync tables, outboxes, or tombstones - because there is no backend and adding
that machinery prematurely would add cost without value. It can be introduced later behind the data
layer (for example via a repository combining local records with a sync source) without changing
interactors or views.
