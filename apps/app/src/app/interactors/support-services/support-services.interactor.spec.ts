import { TestBed } from '@angular/core/testing';

import { SupportServiceCatalogGateway } from '@app/data/gateways/support-service-catalog.gateway';
import type {
  SupportServiceCatalog,
  SupportServiceCatalogItem,
} from '@app/data/gateways/support-service-catalog.gateway';
import { SQLITE_DATABASE } from '@app/data/gateways/sqlite-database';
import { InMemorySqliteDatabase } from '@app/data/gateways/sqlite-database.testing';
import { MIGRATIONS } from '@app/data/migrations/migrations';

import { SupportServicesInteractor } from './support-services.interactor';

class FakeSupportServiceCatalogGateway {
  items: SupportServiceCatalogItem[] = [];

  fetchCatalog(): Promise<SupportServiceCatalog | null> {
    return Promise.resolve({ version: 1, items: this.items });
  }
}

function service(
  id: string,
  region: string,
  name: string,
  teaser = 'T',
  actions: SupportServiceCatalogItem['actions'] = [],
): SupportServiceCatalogItem {
  return { id, region, name, teaser, icon: '🧠', actions };
}

describe('SupportServicesInteractor', () => {
  let gateway: FakeSupportServiceCatalogGateway;
  let database: InMemorySqliteDatabase;
  let interactor: SupportServicesInteractor;

  beforeEach(() => {
    gateway = new FakeSupportServiceCatalogGateway();
    database = new InMemorySqliteDatabase();
    database.migrate(MIGRATIONS);
    localStorage.clear();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SupportServiceCatalogGateway, useValue: gateway },
        { provide: SQLITE_DATABASE, useValue: database },
      ],
    });

    interactor = TestBed.inject(SupportServicesInteractor);
  });

  afterEach(() => {
    database.close();
  });

  it('reads the catalog file once per session, not on every search', async () => {
    gateway.items = [service('perg', 'oberoesterreich', 'Frauenberatung Perg')];
    const fetchCatalog = vi.spyOn(gateway, 'fetchCatalog');

    await interactor.listAll();
    await interactor.search('frau');
    await interactor.search('frauen');

    expect(fetchCatalog).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    beforeEach(() => {
      gateway.items = [
        service('rat-auf-draht', 'online', 'Rat auf Draht', 'Beratung für Kinder und Jugendliche', [
          { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
        ]),
        service('perg', 'oberoesterreich', 'Frauenberatung Perg'),
        service('evita', 'tirol', 'Evita, Frauen- und Mädchen*beratungsstelle'),
        service('zara', 'online', 'ZARA', 'Beratungsstellen #GegenHassimNetz'),
      ];
    });

    async function ids(query: string): Promise<string[] | undefined> {
      return (await interactor.search(query))?.map((item) => item.id);
    }

    it('finds a term inside a compound, across every region, the best match first', async () => {
      const found = await ids('beratung');

      expect(found).toHaveLength(4);
      // A hit in the name outranks one in the teaser.
      expect(found!.slice(0, 2).sort()).toEqual(['evita', 'perg']);
    });

    it('requires every term, and searches the region by its name', async () => {
      await expect(ids('frauen tirol')).resolves.toEqual(['evita']);
    });

    it('finds an entry by the number it shows', async () => {
      await expect(ids('147')).resolves.toEqual(['rat-auf-draht']);
    });

    it('reads a gendered word without its gender character', async () => {
      await expect(ids('mädchenberatung')).resolves.toEqual(['evita']);
    });

    it('is empty when nothing matches', async () => {
      await expect(ids('schwimmbad')).resolves.toEqual([]);
    });

    it('is null for a query too short to search', async () => {
      await expect(interactor.search('ab')).resolves.toBeNull();
    });
  });

  describe('listAll', () => {
    it('maps catalog items to view models, defaulting missing fields', async () => {
      gateway.items = [
        {
          id: 'zara',
          region: 'online',
          name: 'ZARA',
          teaser: 'Beratungsstellen #GegenHassimNetz und !GegenRassismus',
          icon: '✊',
          actions: [
            {
              type: 'website',
              label: 'Webseite',
              uri: 'https://zara.or.at/beratung/',
            },
          ],
        },
      ];

      await expect(interactor.listAll()).resolves.toEqual([
        {
          id: 'zara',
          region: 'online',
          name: 'ZARA',
          teaser: 'Beratungsstellen #GegenHassimNetz und !GegenRassismus',
          icon: '✊',
          actions: [
            {
              type: 'website',
              label: 'Webseite',
              uri: 'https://zara.or.at/beratung/',
              displayValue: null,
            },
          ],
        },
      ]);
    });

    it('keeps an action list as authored', async () => {
      gateway.items = [
        {
          id: 'rat-auf-draht',
          region: 'online',
          name: 'Rat auf Draht',
          teaser: 'Beratung für Kinder und Jugendliche',
          icon: '🧠',
          actions: [
            { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
            { type: 'chat', label: 'Chat', uri: 'https://www.rataufdraht.at/chatberatung' },
          ],
        },
      ];

      const [item] = await interactor.listAll();
      expect(item.actions).toEqual([
        { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
        {
          type: 'chat',
          label: 'Chat',
          uri: 'https://www.rataufdraht.at/chatberatung',
          displayValue: null,
        },
      ]);
    });

    it('keeps the icon as authored', async () => {
      gateway.items = [
        {
          id: 'rat-auf-draht',
          region: 'online',
          name: 'Rat auf Draht',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
      ];

      const [item] = await interactor.listAll();
      expect(item.icon).toBe('🧠');
    });

    it('is empty when the catalog is empty', async () => {
      await expect(interactor.listAll()).resolves.toEqual([]);
    });
  });

  describe('listByIds', () => {
    it('lists the entries in the order the ids name them, leaving out unknown ids', async () => {
      gateway.items = [
        service('rat-auf-draht', 'online', 'Rat auf Draht'),
        service('kindernotruf', 'online', 'Kindernotruf'),
        service('ifs-kinderschutz', 'vorarlberg', 'ifs Kinderschutz'),
      ];

      const listed = await interactor.listByIds(['ifs-kinderschutz', 'gone', 'rat-auf-draht']);

      expect(listed.map((entry) => entry.id)).toEqual(['ifs-kinderschutz', 'rat-auf-draht']);
    });

    it('is empty for no ids', async () => {
      gateway.items = [service('rat-auf-draht', 'online', 'Rat auf Draht')];

      await expect(interactor.listByIds([])).resolves.toEqual([]);
    });
  });

  describe('listRegions', () => {
    it('is empty when the catalog is empty', async () => {
      await expect(interactor.listRegions()).resolves.toEqual([]);
    });

    it('lists only regions with at least one entry, online first', async () => {
      gateway.items = [
        {
          id: 'a',
          region: 'vorarlberg',
          name: 'A',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
        {
          id: 'b',
          region: 'online',
          name: 'B',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
      ];

      await expect(interactor.listRegions()).resolves.toEqual([
        { id: 'online', label: 'Online & Telefon' },
        { id: 'vorarlberg', label: 'Vorarlberg' },
      ]);
    });

    it('orders states as Vorarlberg, Tirol, Salzburg, then the rest', async () => {
      gateway.items = [
        {
          id: 'a',
          region: 'salzburg',
          name: 'A',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
        {
          id: 'b',
          region: 'wien',
          name: 'B',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
        {
          id: 'c',
          region: 'tirol',
          name: 'C',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
        {
          id: 'd',
          region: 'vorarlberg',
          name: 'D',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
      ];

      await expect(interactor.listRegions()).resolves.toEqual([
        { id: 'vorarlberg', label: 'Vorarlberg' },
        { id: 'tirol', label: 'Tirol' },
        { id: 'salzburg', label: 'Salzburg' },
        { id: 'wien', label: 'Wien' },
      ]);
    });

    it('does not list a region with zero entries', async () => {
      gateway.items = [
        {
          id: 'a',
          region: 'online',
          name: 'A',
          teaser: 'T',
          icon: '🧠',
          actions: [],
        },
      ];

      const regions = await interactor.listRegions();
      expect(regions.some((region) => region.id === 'vorarlberg')).toBe(false);
    });
  });
});
