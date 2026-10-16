/**
 * Resolves a bundled asset against the document's `<base href>`.
 *
 * On a device and at the server root the base href is `/`, so the result is the root-relative path
 * itself. Going through here keeps the app working when a browser build is served from a
 * subdirectory (`--base-href`), which rewrites `index.html` and the bundles but never a string in
 * TypeScript.
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
