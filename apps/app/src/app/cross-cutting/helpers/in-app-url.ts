/**
 * Validates a `?returnTo=` value before it is handed to the router.
 *
 * A screen reachable from several places carries where it was opened from in a query param, which
 * means the value arrives from the URL and can say anything - including `//example.com`, which the
 * router would treat as a protocol-relative address rather than as a route of this app. Only a
 * single leading slash, no backslashes (WebKit reads `/\` as a scheme-relative URL too) and no
 * whitespace pass; everything else returns `null`, and the caller falls back to its static target.
 */
export function safeInAppUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const isInApp =
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\\s]/.test(value) &&
    value.length <= 512;

  return isInApp ? value : null;
}
