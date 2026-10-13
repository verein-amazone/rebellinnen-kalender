import { TestBed } from '@angular/core/testing';

import { ImageCatalogGateway, type ImageCatalogEntry } from './image-catalog.gateway';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

/** An entry as the file holds it: no path, which follows from the id. */
const STORED = {
  id: 'menstruation-hormone-zyklus',
  title: 'Titel',
  alt: 'Viele rote Tropfen auf dunkelblauem Grund.',
  creator: 'Verein Amazone',
  source: 'Verein Amazone',
  license: 'CC BY-NC-ND 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  changes: ['resized'],
};

const ENTRY: ImageCatalogEntry = {
  ...STORED,
  path: '/content/images/menstruation-hormone-zyklus.webp',
};

describe('ImageCatalogGateway', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function setup(response: () => Promise<Response>): ImageCatalogGateway {
    fetchMock = vi.fn(response);
    vi.stubGlobal('fetch', fetchMock);
    TestBed.resetTestingModule();
    return TestBed.inject(ImageCatalogGateway);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the parsed catalog, with each file path derived from the id', async () => {
    const gateway = setup(() => Promise.resolve(jsonResponse([STORED])));

    expect(await gateway.list()).toEqual([ENTRY]);
  });

  it('finds an image by its id, and null for one it does not know', async () => {
    const gateway = setup(() => Promise.resolve(jsonResponse([STORED])));

    expect(await gateway.find(ENTRY.id)).toEqual(ENTRY);
    expect(await gateway.find('unbekannt')).toBeNull();
  });

  it('reads the file once', async () => {
    const gateway = setup(() => Promise.resolve(jsonResponse([STORED])));

    await gateway.list();
    await gateway.find(ENTRY.id);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('accepts an image whose creator is unknown', async () => {
    const anonymous = Object.fromEntries(
      Object.entries(STORED).filter(([key]) => key !== 'creator'),
    );
    const gateway = setup(() => Promise.resolve(jsonResponse([anonymous])));

    expect(await gateway.list()).toEqual([{ ...anonymous, path: ENTRY.path }]);
  });

  it('returns an empty list when the file is missing, and tries again next time', async () => {
    const gateway = setup(() => Promise.resolve(jsonResponse([], false)));

    expect(await gateway.list()).toEqual([]);
    expect(await gateway.list()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty list when reading the file throws', async () => {
    const gateway = setup(() => Promise.reject(new Error('network down')));

    expect(await gateway.list()).toEqual([]);
  });

  it('returns an empty list for a malformed payload or an entry without a description', async () => {
    expect(await setup(() => Promise.resolve(jsonResponse({ not: 'a list' }))).list()).toEqual([]);

    const withoutAlt = Object.fromEntries(Object.entries(STORED).filter(([key]) => key !== 'alt'));
    expect(await setup(() => Promise.resolve(jsonResponse([withoutAlt]))).list()).toEqual([]);
  });
});
