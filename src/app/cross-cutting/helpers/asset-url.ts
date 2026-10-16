/**
 * Resolves a bundled asset against the document's `<base href>`.
 *
 * On a device the base href is the WebView's root, so the result is the same root-relative path
 * that used to be written out by hand. On the web the app can also be served from a subdirectory - a
 * pull-request preview of the GitHub Pages demo lives under `/pr-<n>/` - where a path starting at
 * the server root would miss the deployment entirely. `--base-href` rewrites `index.html` and the bundles, but never a string in
 * TypeScript, so every asset path the app builds itself goes through here.
 *
 * A path rather than an absolute URL on purpose: an absolute one would carry the WebView's
 * `capacitor://` scheme on iOS, which Angular's URL sanitizer rejects in an `[src]` binding.
 *
 * The leading slash of the argument is optional, so a derived path such as an image's
 * (`/content/images/…`, built without knowing the deployment) resolves the same way a literal does.
 */
export function assetUrl(path: string): string {
  return new URL(path.replace(/^\/+/, ''), document.baseURI).pathname;
}
