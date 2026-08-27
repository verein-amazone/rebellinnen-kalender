/**
 * Handling for subscription URLs, which may embed access tokens and are treated as sensitive.
 * The full URL lives only in the `ics_subscriptions` table; everything that logs, displays or
 * reports uses the redacted form.
 */

export class IcsUrlInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IcsUrlInvalidError';
  }
}

/**
 * Validates a subscription URL. `webcal:`/`webcals:` are the common copy-paste forms and are
 * rewritten to HTTPS; plain `http:` needs an explicit opt-in.
 */
export function normalizeIcsUrl(raw: string, options: { allowInsecure: boolean }): string {
  // The URL API refuses a protocol change from a non-special scheme, so webcal is rewritten on the
  // string first.
  const rewritten = raw.trim().replace(/^webcals?:\/\//i, 'https://');

  let url: URL;
  try {
    url = new URL(rewritten);
  } catch {
    throw new IcsUrlInvalidError('Der Link ist keine gültige Adresse.');
  }

  if (url.protocol === 'http:' && !options.allowInsecure) {
    throw new IcsUrlInvalidError('Der Link muss mit https beginnen.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new IcsUrlInvalidError('Der Link muss ein Webkalender-Link sein.');
  }

  return url.toString();
}

/**
 * The only form of a subscription URL that may ever be logged or displayed: origin plus the last
 * few characters of the path - enough to recognise the calendar, never enough to fetch it.
 */
export function redactIcsUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const tail = url.pathname.length > 4 ? url.pathname.slice(-4) : url.pathname;
    return `${url.origin}/…${tail}`;
  } catch {
    return '…';
  }
}
