import { CREATE_SCHEMA } from './019-create-schema';
import type { Migration } from './migration';

/**
 * Every schema version the app has shipped since 1.0.0, ordered by `toVersion`.
 *
 * Version 19 is the baseline: the pre-release versions 1-18 were squashed into it, and it drops and
 * recreates whatever a pre-release build left on a device (see `019-create-schema.ts`).
 *
 * Never edit a migration that has shipped: a device that already applied it will not run it again,
 * so the edit would only affect fresh installs and the two would drift apart. Add a new migration
 * with the next `toVersion` instead.
 */
export const MIGRATIONS: readonly Migration[] = [CREATE_SCHEMA];

/** The version a freshly opened database is upgraded to. Derived, so it cannot fall behind. */
export const DATABASE_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.toVersion),
  0,
);
