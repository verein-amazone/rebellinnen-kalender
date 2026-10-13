import { scopedStorageName } from '@app/cross-cutting/infrastructure/deployment-scope';

/**
 * The application database's name. One database per deployment: unchanged on a device and at the
 * server root, while the web demo build and every pull-request preview share an origin and
 * therefore need their own, see `scopedStorageName`.
 *
 * `e2e/support/calendar-seed.ts` relies on the unscoped value at the server root.
 */
export const DATABASE_NAME = scopedStorageName('rebellinnen-kalender');
