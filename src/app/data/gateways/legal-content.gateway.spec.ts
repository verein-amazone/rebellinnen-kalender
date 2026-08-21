import { TestBed } from '@angular/core/testing';

import { LegalContentGateway } from './legal-content.gateway';

function stubFetch(implementation: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(implementation));
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

function textResponse(body: string, ok = true): Response {
  return { ok, text: () => Promise.resolve(body) } as Response;
}

describe('LegalContentGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(): LegalContentGateway {
    TestBed.resetTestingModule();
    return TestBed.inject(LegalContentGateway);
  }

  it('returns the bundled third-party licence text', async () => {
    stubFetch(() => Promise.resolve(textResponse('MIT License...')));
    const gateway = setup();

    expect(await gateway.fetchThirdPartyLicenses()).toBe('MIT License...');
  });

  it('returns null when the third-party licence file is missing', async () => {
    stubFetch(() => Promise.resolve(textResponse('', false)));
    const gateway = setup();

    expect(await gateway.fetchThirdPartyLicenses()).toBeNull();
  });

  it('returns null when fetching the third-party licence file throws', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));
    const gateway = setup();

    expect(await gateway.fetchThirdPartyLicenses()).toBeNull();
  });

  it('returns the parsed image attributions', async () => {
    const entries = [
      {
        path: '/content/wissensimpulse/wi-01.webp',
        title: 'Titel',
        creator: 'Verein Amazone',
        source: 'Verein Amazone',
        license: 'All rights reserved (used with permission)',
        licenseUrl: null,
        changes: ['resized'],
      },
    ];
    stubFetch(() => Promise.resolve(jsonResponse(entries)));
    const gateway = setup();

    expect(await gateway.fetchImageAttributions()).toEqual(entries);
  });

  it('returns an empty list when the image attribution file is missing', async () => {
    stubFetch(() => Promise.resolve(jsonResponse([], false)));
    const gateway = setup();

    expect(await gateway.fetchImageAttributions()).toEqual([]);
  });

  it('returns an empty list for a malformed image attribution payload', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ not: 'a list' })));
    const gateway = setup();

    expect(await gateway.fetchImageAttributions()).toEqual([]);
  });
});
