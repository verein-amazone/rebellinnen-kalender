# Data & persistence

This document describes how the app stores data and the conventions the data layer must follow. It
complements [frontend-architecture.md](./frontend-architecture.md).

> Status: the SQLite foundation exists (gateway, migration registry, first migration, first DAO), and
> the first table is `reminders` for the „Nicht vergessen“ list. The native calendar gateway is still
> outstanding.

## Local-only persistence

The app works **without login and without its own server infrastructure**. All application-owned
data is stored locally on the device. There is no backend, no cloud synchronization, and no
authentication.

## SQLite via `@capacitor-community/sqlite`

Relational, application-owned data is persisted in SQLite through
[`@capacitor-community/sqlite`](https://github.com/capacitor-community/sqlite), accessed behind DAOs
and versioned migrations.

### The database gateway

`data/gateways/sqlite.gateway.ts` is the only file that imports the plugin. Everything above it
depends on the `SqliteDatabase` contract in `sqlite-database.ts` — `query()` and `run()`, plus a
`SqliteUnavailableError` and the `SQLITE_DATABASE` token DAOs inject. Two consequences worth knowing:

- **The connection opens lazily on first use, not from an app initializer.** Nothing in the first
  paint needs the database, and a database that cannot open has to surface as an error inside the
  screen that wanted it rather than aborting the bootstrap. The open promise is memoised so
  concurrent callers share one open sequence, and it is dropped on failure so a retry really retries.
- **The open sequence starts with `checkConnectionsConsistency()`.** The plugin keeps a connection
  dictionary that survives a dev-server reload; without this reconciliation `createConnection` fails
  after every HMR update.

There is deliberately **no `transaction()` method yet**: `SQLiteDBConnection.run()` already wraps a
statement in its own transaction, and no use case so far spans more than one statement. It gets added
with the first one that does. Reordering the „Nicht vergessen“ list is the case that came closest and
still does not need one — see [Manual order](#manual-order) for how it stays a single statement.

### SQLite in the browser

The app ships to iOS and Android only. The browser is used for `ng serve` and the Playwright suite,
and it gets **real** SQLite there: `data/gateways/web-sqlite-store.ts` lazily loads the `jeep-sqlite`
custom element (`sql.js` compiled to WebAssembly, persisted in IndexedDB) and calls `initWebStore()`,
and every successful write is followed by `saveToStore()`. That way the handwritten SQL and the
migrations that run on a phone are the same ones a developer clicks through.

Two things to keep in mind:

- `sql.js` is pinned to an **exact** version in `package.json`. `jeep-sqlite` bundles the Emscripten
  glue of the release it was built against, and a newer `sql-wasm.wasm` next to that older glue fails
  to instantiate with a `LinkError`. Upgrade both together and check the Today page in a browser.
- `sql-wasm.wasm` is copied by the **development** build only (see `angular.json`). A production web
  build therefore cannot open a database — intentionally, because there is no web product.

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

## Migrations

All schema changes are **versioned migrations** under `data/migrations/`: one file per version
(`001-create-reminders.ts`), collected in `migrations.ts`, which also derives `DATABASE_VERSION` from
the highest `toVersion`. Never mutate an existing shipped migration — a device that already applied
it will not run it again, so the edit would only reach fresh installs and the two would drift apart.
Add a new migration instead.

Applying them is the plugin's job, not ours: the gateway hands the registry to
`addUpgradeStatement()` and asks `createConnection()` for `DATABASE_VERSION`. That mechanism is
supported on every platform, applies each upgrade in a transaction (with a backup on native), and
reports the same number through `getVersion()` — a hand-rolled `user_version` loop would duplicate
that bookkeeping and could disagree with it.

## Transaction boundaries

A single logical unit of work (for example, a multi-table write for one use case) should run inside
one transaction. Transaction control belongs at the boundary that represents the unit of work
(typically coordinated from an interactor calling one or more DAOs with a shared transaction), not
buried inside unrelated DAO methods.

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
disagree with the timestamp, so there is none. The list is read in exactly one order —
`ORDER BY (completed_at IS NULL) DESC, position ASC, created_at ASC`, i.e. open entries first, each
section in the order the user arranged, with `created_at` only breaking a tie — and the table's only
index mirrors that.

### Manual order

`position` is a `REAL`, not an integer rank. Moving an entry between two others writes the midpoint of
their positions, so a reorder is a **single-row `UPDATE`** — and a single statement is already atomic,
which is why dragging a row does not need transaction support that does not exist. An entry entering a
section gets one step (1000) beyond the end it enters at.

Fractional positions can only be halved so many times before two doubles round to the same value. When
the gap between the neighbours falls below `1e-6` the interactor renumbers that section instead —
still in one statement, built as `SET position = CASE id WHEN ? THEN ? … END` by
`ReminderDao.reassignPositions`. Reaching that point takes roughly fifty drops into the same shrinking
gap; writing it as a loop of updates would have been the only part of the feature that could be
interrupted halfway.

Completing or reopening an entry moves it into the other section and therefore always writes a new
position with the same statement (`updateCompletion`): a half-applied move would order the entry by a
position belonging to the section it just left.

**Hiding completed entries at the day change is an interactor rule, not SQL.** `completed_at` is a UTC
instant while the cutoff is local midnight, and SQLite's `localtime` modifier resolves against the host
process' zone — which is not the same on the native plugin and in the `jeep-sqlite` build — and cannot
be bound as a parameter. It is also a product rule driven by a preference, and DAOs hold no business
rules. Hidden entries are only filtered out of the list; the rows stay in the database.

## Native calendar gateway boundary

The device calendar is read through a gateway (e.g. `data/gateways/native-calendar.gateway.ts`)
wrapping [`@ebarooni/capacitor-calendar`](https://github.com/ebarooni/capacitor-calendar). The
gateway **prevents Capacitor plugin types from leaking** into interactors or views. The gateway is
not implemented yet, and no calendar permissions are requested on startup.

## What is and is not stored in SQLite

Stored locally:

- The „Nicht vergessen“ list (`reminders`).
- App-owned events and content.
- Calendar selections and the minimal mappings needed to relate app data to device calendar entries.

Not stored:

- Device calendar events are **not** copied into SQLite. They are queried through the native
  calendar gateway on demand.

## Stores

`data/stores/*.store.ts` hold small persisted values that do not belong in a relational table — the
appearance preferences (`appearance.store.ts`) and the preferences of the „Nicht vergessen“ list
(`reminders.store.ts`). They persist to `localStorage`, which is available in both the iOS and Android
WebViews, survives restarts, and avoids paying the SQLite connection cost for a handful of scalars read
on every startup.

`reminders.store.ts` is the one to look at for the boundary: it holds where a new or completed entry
enters its section and whether completed entries disappear at the day change — three scalars. The
entries themselves stay in SQLite.

Stores expose their state as signals and **validate on read**: a stored value may come from an older
app version or from a manually edited storage entry, so an unrecognised value falls back to the
documented default instead of reaching the rest of the app.

`localStorage` access throws in some privacy modes, so it is never touched directly — reads and
writes are guarded, and a lost preference is preferable to a broken app.

A store is **not** where a table-backed list belongs. The screen that shows one holds it in a
`resource()` and reloads after each write (see
[frontend-architecture.md](./frontend-architecture.md)); interactors stay stateless. When a second
consumer of the same list appears, that cache can be promoted into the data layer — and this
document amended.

## Future synchronization

The design keeps future sync possible through clean boundaries and stable IDs (client-generated
UUIDs, separated external identifiers). We deliberately do **not** implement synchronization
infrastructure now — no sync tables, outboxes, or tombstones — because there is no backend and adding
that machinery prematurely would add cost without value. It can be introduced later behind the data
layer (for example via a repository combining local records with a sync source) without changing
interactors or views.
