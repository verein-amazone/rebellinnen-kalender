/**
 * Which deployment of the app this is, derived from the document's `<base href>`.
 *
 * On a device, and on a web build served from the server root (`ng serve`, `pnpm serve:dist`, the
 * Playwright suite), this is the empty string and nothing is namespaced - storage keeps the names
 * it has always had.
 *
 * The web demo build and its pull-request previews are different: they are served from
 * subdirectories of one and the same origin (`/rebellinnen-kalender/`,
 * `/rebellinnen-kalender/pr-12/`, …). A browser scopes IndexedDB and `localStorage` to the origin,
 * never to the path, so without a discriminator a preview would open, migrate and write the same
 * database the demo site uses - a pull request with a new migration would silently upgrade a
 * tester's data, and the demo build would then meet a schema from the future.
 *
 * A plain function rather than an injectable service, because the first caller is the SQLite
 * gateway, which is constructed before anything view-facing exists.
 */
export function deploymentSlug(): string {
  const path = new URL(document.baseURI).pathname;

  return path
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
}

/**
 * Appends the deployment to a storage name, so every deployment on one origin gets its own.
 * Unchanged at the server root, which is what keeps the e2e suite and local development on the
 * names the specs and `e2e/support/calendar-seed.ts` expect.
 */
export function scopedStorageName(name: string): string {
  const slug = deploymentSlug();

  return slug === '' ? name : `${name}@${slug}`;
}
