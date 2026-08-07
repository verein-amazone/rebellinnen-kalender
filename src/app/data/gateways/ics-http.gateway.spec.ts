import { TestBed } from '@angular/core/testing';

import { ICS_MAX_BYTES, IcsDownloadError, IcsHttpGateway } from './ics-http.gateway';

function streamResponse(init: {
  status: number;
  body?: Uint8Array;
  headers?: Record<string, string>;
}): Response {
  const chunk = init.body;
  const body =
    chunk === undefined
      ? null
      : new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(chunk);
            controller.close();
          },
        });

  return new Response(body, { status: init.status, headers: init.headers });
}

describe('IcsHttpGateway (web/fetch path)', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    TestBed.resetTestingModule();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('downloads the body and forwards etag/last-modified', async () => {
    let requestHeaders: Headers | undefined;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      requestHeaders = new Headers(init?.headers);
      return streamResponse({
        status: 200,
        body: new TextEncoder().encode('BEGIN:VCALENDAR\r\nEND:VCALENDAR'),
        headers: { etag: '"v1"', 'last-modified': 'Mon, 01 Jan 2026 00:00:00 GMT' },
      });
    }) as typeof fetch;

    const gateway = TestBed.inject(IcsHttpGateway);
    const result = await gateway.download({
      url: 'https://example.org/cal.ics',
      etag: '"cached"',
      lastModified: 'Sun, 31 Dec 2025 00:00:00 GMT',
    });

    expect(result).toEqual({
      status: 'ok',
      body: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
      etag: '"v1"',
      lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT',
    });
    expect(requestHeaders?.get('If-None-Match')).toBe('"cached"');
    expect(requestHeaders?.get('If-Modified-Since')).toBe('Sun, 31 Dec 2025 00:00:00 GMT');
  });

  it('treats a 304 as unchanged without reading a body', async () => {
    globalThis.fetch = (async () => streamResponse({ status: 304 })) as typeof fetch;

    const gateway = TestBed.inject(IcsHttpGateway);

    await expect(
      gateway.download({ url: 'https://example.org/cal.ics', etag: '"v1"', lastModified: null }),
    ).resolves.toEqual({ status: 'not-modified' });
  });

  it('rejects a non-2xx, non-304 response without the URL in the message', async () => {
    globalThis.fetch = (async () => streamResponse({ status: 500 })) as typeof fetch;

    const gateway = TestBed.inject(IcsHttpGateway);

    await expect(
      gateway.download({
        url: 'https://example.org/secret-token/cal.ics',
        etag: null,
        lastModified: null,
      }),
    ).rejects.toMatchObject({ message: expect.not.stringContaining('secret-token') as unknown });
  });

  it('aborts a stream mid-download once it exceeds the byte limit, without buffering the rest', async () => {
    const oversized = new Uint8Array(ICS_MAX_BYTES + 1);
    let cancelled = false;

    globalThis.fetch = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            // Left open (no close()) — a still-downloading body, so the reader's cancel() below
            // actually reaches the underlying source's cancel algorithm instead of a no-op on an
            // already-closed stream.
            controller.enqueue(oversized);
          },
          cancel() {
            cancelled = true;
          },
        }),
        { status: 200 },
      )) as typeof fetch;

    const gateway = TestBed.inject(IcsHttpGateway);

    await expect(
      gateway.download({ url: 'https://example.org/cal.ics', etag: null, lastModified: null }),
    ).rejects.toBeInstanceOf(IcsDownloadError);
    expect(cancelled).toBe(true);
  });

  it('measures the byte limit precisely, not the UTF-16 code-unit count', async () => {
    // Each 'ü' is one UTF-16 code unit but two UTF-8 bytes — a code-unit-based check would let
    // roughly double the intended byte budget through.
    const nearLimitChars = Math.floor(ICS_MAX_BYTES / 2) + 10;
    const oversizedText = 'ü'.repeat(nearLimitChars);
    globalThis.fetch = (async () =>
      streamResponse({
        status: 200,
        body: new TextEncoder().encode(oversizedText),
      })) as typeof fetch;

    const gateway = TestBed.inject(IcsHttpGateway);

    await expect(
      gateway.download({ url: 'https://example.org/cal.ics', etag: null, lastModified: null }),
    ).rejects.toBeInstanceOf(IcsDownloadError);
  });
});
