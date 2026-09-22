/**
 * Resolves a bundled asset against the document's `<base href>`.
 *
 * On a device the base href is the WebView's root, so the result is the same root-relative path
 * that used to be written out by hand. On the web the app is also served from a subdirectory - the
 * GitHub Pages demo build lives under `/rebellinnen-kalender/`, a pull-request preview under
 * `/rebellinnen-kalender/pr-<n>/` - where a path starting at the server root would miss the
 * deployment entirely. `--base-href` rewrites `index.html` and the bundles, but never a string in
 * TypeScript, so every asset path the app builds itself goes through here.
 *
 * A path rather than an absolute URL on purpose: an absolute one would carry the WebView's
 * `capacitor://` scheme on iOS, which Angular's URL sanitizer rejects in an `[src]` binding.
 *
 * The leading slash of the argument is optional, so a stored value such as the `imagePath` of a
 * content item (`/content/…`, written to SQLite long before the deployment was known) resolves the
 * same way a literal does.
 */
export function assetUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).pathname;
}
