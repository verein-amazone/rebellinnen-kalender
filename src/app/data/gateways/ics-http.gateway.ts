import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';

import { devicePlatform } from '@app/cross-cutting/infrastructure/device-platform';

/**
 * Kept small on purpose: a subscribed calendar is text, not an archive. A genuine **byte** limit -
 * `string.length` counts UTF-16 code units, which under-counts every multi-byte UTF-8 character
 * (an umlaut-heavy German feed would slip past a code-unit check well over this size).
 */
export const ICS_MAX_BYTES = 5 * 1024 * 1024;
export const ICS_TIMEOUT_MS = 15_000;

export class IcsDownloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'IcsDownloadError';
  }
}

export interface IcsDownloadRequest {
  readonly url: string;
  readonly etag: string | null;
  readonly lastModified: string | null;
}

export type IcsDownloadResult =
  | {
      readonly status: 'ok';
      readonly body: string;
      readonly etag: string | null;
      readonly lastModified: string | null;
    }
  | { readonly status: 'not-modified' };

/**
 * Downloads ICS documents - the only place subscription HTTP happens.
 *
 * On device the request goes through `CapacitorHttp`, which runs natively and is therefore not
 * subject to WebView CORS: arbitrary user-provided calendar servers do not send CORS headers. In
 * the browser (`ng serve`, e2e) plain `fetch` is used. Conditional requests send `If-None-Match`/
 * `If-Modified-Since`, so an unchanged feed costs one 304 and no body. Errors never contain the
 * full URL - it may embed an access token.
 */
@Injectable({ providedIn: 'root' })
export class IcsHttpGateway {
  private readonly isWeb = devicePlatform() === 'web';

  async download(request: IcsDownloadRequest): Promise<IcsDownloadResult> {
    return this.isWeb ? this.downloadWithFetch(request) : this.downloadNatively(request);
  }

  private async downloadNatively(request: IcsDownloadRequest): Promise<IcsDownloadResult> {
    let response;
    try {
      response = await CapacitorHttp.get({
        url: request.url,
        headers: conditionalHeaders(request),
        connectTimeout: ICS_TIMEOUT_MS,
        readTimeout: ICS_TIMEOUT_MS,
        responseType: 'text',
      });
    } catch (cause) {
      throw new IcsDownloadError('Der Kalender konnte nicht geladen werden.', { cause });
    }

    if (response.status === 304) {
      return { status: 'not-modified' };
    }
    if (response.status < 200 || response.status >= 300) {
      throw new IcsDownloadError(
        `Der Kalender-Server hat mit Status ${response.status} geantwortet.`,
      );
    }

    const body = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    // The plugin has no streaming API, so this only rejects a body already fully downloaded and
    // buffered in memory - a real streaming cutoff exists only on the fetch path below.
    assertSizeInBytes(body);

    return {
      status: 'ok',
      body,
      etag: headerOf(response.headers, 'etag'),
      lastModified: headerOf(response.headers, 'last-modified'),
    };
  }

  private async downloadWithFetch(request: IcsDownloadRequest): Promise<IcsDownloadResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ICS_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(request.url, {
        headers: conditionalHeaders(request),
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch (cause) {
      throw new IcsDownloadError('Der Kalender konnte nicht geladen werden.', { cause });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 304) {
      return { status: 'not-modified' };
    }
    if (!response.ok) {
      throw new IcsDownloadError(
        `Der Kalender-Server hat mit Status ${response.status} geantwortet.`,
      );
    }

    const body = await readWithLimit(response);

    return {
      status: 'ok',
      body,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  }
}

/**
 * Reads the response body as a stream and aborts as soon as it exceeds the limit, instead of
 * buffering an arbitrarily large body first and only then checking its size - the one path here
 * that can actually enforce the limit during the download rather than after it.
 */
async function readWithLimit(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    // No streaming body in this environment (e.g. an older browser) - fall back to buffering.
    const body = await response.text();
    assertSizeInBytes(body);
    return body;
  }

  const decoder = new TextDecoder();
  let text = '';
  let bytesRead = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      text += decoder.decode();
      return text;
    }

    bytesRead += value.byteLength;
    if (bytesRead > ICS_MAX_BYTES) {
      await reader.cancel();
      throw new IcsDownloadError('Der Kalender ist zu groß.');
    }

    text += decoder.decode(value, { stream: true });
  }
}

function conditionalHeaders(request: IcsDownloadRequest): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'text/calendar, text/plain;q=0.5' };
  if (request.etag !== null) {
    headers['If-None-Match'] = request.etag;
  }
  if (request.lastModified !== null) {
    headers['If-Modified-Since'] = request.lastModified;
  }

  return headers;
}

function assertSizeInBytes(body: string): void {
  if (new TextEncoder().encode(body).byteLength > ICS_MAX_BYTES) {
    throw new IcsDownloadError('Der Kalender ist zu groß.');
  }
}

function headerOf(headers: Record<string, string> | undefined, name: string): string | null {
  if (headers === undefined) {
    return null;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) {
      return value;
    }
  }

  return null;
}
