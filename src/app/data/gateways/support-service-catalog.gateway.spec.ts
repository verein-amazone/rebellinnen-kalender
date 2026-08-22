import { TestBed } from '@angular/core/testing';

import { SupportServiceCatalogGateway } from './support-service-catalog.gateway';

function stubFetch(implementation: (url: string) => Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(implementation));
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe('SupportServiceCatalogGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup(): SupportServiceCatalogGateway {
    TestBed.resetTestingModule();
    return TestBed.inject(SupportServiceCatalogGateway);
  }

  const validItem = {
    id: 'rat-auf-draht',
    region: 'online',
    name: 'Rat auf Draht',
    teaser: 'Beratung für Kinder und Jugendliche',
    crisis: true,
    icon: '🧠',
    color: '#E92F2A',
    actions: [
      { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
      { type: 'chat', label: 'Chat', uri: 'https://www.rataufdraht.at/chatberatung' },
    ],
  };

  it('returns the catalog items', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [validItem] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([validItem]);
  });

  it('returns an empty list when the catalog file is missing', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({}, false)));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([]);
  });

  it('returns an empty list when fetching the catalog throws', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([]);
  });

  it('returns an empty list for a malformed payload', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: 'not a list' })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([]);
  });

  it('drops items missing a required field', async () => {
    const invalidItem = { id: 'x', region: 'online', name: 'X' };
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [validItem, invalidItem] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([validItem]);
  });

  it('drops an item whose action list contains an invalid action', async () => {
    const invalidActionItem = {
      id: 'x',
      region: 'online',
      name: 'X',
      teaser: 'T',
      actions: [{ type: 'phone', label: 'Anrufen' }],
    };
    stubFetch(() =>
      Promise.resolve(jsonResponse({ version: 1, items: [validItem, invalidActionItem] })),
    );
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([validItem]);
  });

  it('drops an item whose action has an unknown type', async () => {
    const unknownActionTypeItem = {
      id: 'x',
      region: 'online',
      name: 'X',
      teaser: 'T',
      actions: [{ type: 'fax', label: 'Faxen', uri: 'fax:123' }],
    };
    stubFetch(() =>
      Promise.resolve(jsonResponse({ version: 1, items: [validItem, unknownActionTypeItem] })),
    );
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([validItem]);
  });

  it('accepts an item with no crisis flag, no logoPath, and an empty action list', async () => {
    const minimalItem = {
      id: 'zara',
      region: 'online',
      name: 'ZARA',
      teaser: 'Beratungsstellen #GegenHassimNetz und !GegenRassismus',
      icon: '✊',
      color: '#7B3FA8',
      actions: [],
    };
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [minimalItem] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([minimalItem]);
  });

  it('accepts an item with a logoPath', async () => {
    const itemWithLogo = { ...validItem, logoPath: '/support-services/logos/rat-auf-draht.webp' };
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [itemWithLogo] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([itemWithLogo]);
  });

  it('drops an item missing icon', async () => {
    const itemWithoutIcon: Record<string, unknown> = { ...validItem };
    delete itemWithoutIcon['icon'];
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [itemWithoutIcon] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([]);
  });

  it('drops an item missing color', async () => {
    const itemWithoutColor: Record<string, unknown> = { ...validItem };
    delete itemWithoutColor['color'];
    stubFetch(() => Promise.resolve(jsonResponse({ version: 1, items: [itemWithoutColor] })));
    const gateway = setup();

    expect(await gateway.fetchCatalog()).toEqual([]);
  });
});
