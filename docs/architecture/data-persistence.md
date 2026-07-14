# Data & persistence

This document describes how the app stores data and the conventions the data layer must follow. It
complements [frontend-architecture.md](./frontend-architecture.md).

> Status: conventions only. No schema, DAOs, migrations, or gateways are implemented yet.

## Local-only persistence

The app works **without login and without its own server infrastructure**. All application-owned
data is stored locally on the device. There is no backend, no cloud synchronization, and no
authentication.

## SQLite via `@capacitor-community/sqlite`

Relational, application-owned data is persisted in SQLite through
[`@capacitor-community/sqlite`](https://github.com/capacitor-community/sqlite), accessed behind DAOs
and versioned migrations.

### No ORM

We deliberately do not install an ORM or query builder:

- The SQLite plugin is fully open source and already familiar from Independo applications.
- Available ORM/query-builder adapters do not currently provide enough confidence for the selected
  Angular 22 and Capacitor 8 stack.
- A small application does not justify the additional abstraction and migration tooling.
- Handwritten SQL stays contained and testable inside the data layer.
- Interactors and views remain independent of the persistence implementation.

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

All schema changes are **versioned migrations** under `data/migrations/`. The initial schema is not
created yet; when it is, it is introduced as the first migration rather than as ad-hoc table
creation. Never mutate an existing shipped migration — add a new one.

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

## Native calendar gateway boundary

The device calendar is read through a gateway (e.g. `data/gateways/native-calendar.gateway.ts`)
wrapping [`@ebarooni/capacitor-calendar`](https://github.com/ebarooni/capacitor-calendar). The
gateway **prevents Capacitor plugin types from leaking** into interactors or views. The gateway is
not implemented yet, and no calendar permissions are requested on startup.

## What is and is not stored in SQLite

Stored locally:

- App-owned events and content.
- Calendar selections and the minimal mappings needed to relate app data to device calendar entries.

Not stored:

- Device calendar events are **not** copied into SQLite. They are queried through the native
  calendar gateway on demand.

## Future synchronization

The design keeps future sync possible through clean boundaries and stable IDs (client-generated
UUIDs, separated external identifiers). We deliberately do **not** implement synchronization
infrastructure now — no sync tables, outboxes, or tombstones — because there is no backend and adding
that machinery prematurely would add cost without value. It can be introduced later behind the data
layer (for example via a repository combining local records with a sync source) without changing
interactors or views.
