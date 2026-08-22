import { TestBed } from '@angular/core/testing';

import { SupportServiceCatalogGateway } from '@app/data/gateways/support-service-catalog.gateway';
import type { SupportServiceCatalogItem } from '@app/data/gateways/support-service-catalog.gateway';

import { SupportServicesInteractor } from './support-services.interactor';

class FakeSupportServiceCatalogGateway {
  items: SupportServiceCatalogItem[] = [];

  fetchCatalog(): Promise<readonly SupportServiceCatalogItem[]> {
    return Promise.resolve(this.items);
  }
}

describe('SupportServicesInteractor', () => {
  let gateway: FakeSupportServiceCatalogGateway;
  let interactor: SupportServicesInteractor;

  beforeEach(() => {
    gateway = new FakeSupportServiceCatalogGateway();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SupportServiceCatalogGateway, useValue: gateway }],
    });

    interactor = TestBed.inject(SupportServicesInteractor);
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
          color: '#7B3FA8',
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
          crisis: false,
          icon: '✊',
          color: '#7B3FA8',
          logoPath: null,
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

    it('keeps a crisis flag and an action list as authored', async () => {
      gateway.items = [
        {
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
        },
      ];

      const [item] = await interactor.listAll();
      expect(item.crisis).toBe(true);
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

    it('keeps icon and color as authored, and defaults logoPath to null', async () => {
      gateway.items = [
        {
          id: 'rat-auf-draht',
          region: 'online',
          name: 'Rat auf Draht',
          teaser: 'T',
          icon: '🧠',
          color: '#E92F2A',
          actions: [],
        },
      ];

      const [item] = await interactor.listAll();
      expect(item.icon).toBe('🧠');
      expect(item.color).toBe('#E92F2A');
      expect(item.logoPath).toBeNull();
    });

    it('carries logoPath through when authored', async () => {
      gateway.items = [
        {
          id: 'verein-amazone',
          region: 'vorarlberg',
          name: 'Verein Amazone',
          teaser: 'T',
          icon: '🏳️‍⚧️',
          color: '#43A047',
          logoPath: '/support-services/logos/verein-amazone.webp',
          actions: [],
        },
      ];

      const [item] = await interactor.listAll();
      expect(item.logoPath).toBe('/support-services/logos/verein-amazone.webp');
    });

    it('is empty when the catalog is empty', async () => {
      await expect(interactor.listAll()).resolves.toEqual([]);
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
          color: '#E92F2A',
          actions: [],
        },
        {
          id: 'b',
          region: 'online',
          name: 'B',
          teaser: 'T',
          icon: '🧠',
          color: '#E92F2A',
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
          color: '#E92F2A',
          actions: [],
        },
        {
          id: 'b',
          region: 'wien',
          name: 'B',
          teaser: 'T',
          icon: '🧠',
          color: '#E92F2A',
          actions: [],
        },
        {
          id: 'c',
          region: 'tirol',
          name: 'C',
          teaser: 'T',
          icon: '🧠',
          color: '#E92F2A',
          actions: [],
        },
        {
          id: 'd',
          region: 'vorarlberg',
          name: 'D',
          teaser: 'T',
          icon: '🧠',
          color: '#E92F2A',
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
          color: '#E92F2A',
          actions: [],
        },
      ];

      const regions = await interactor.listRegions();
      expect(regions.some((region) => region.id === 'vorarlberg')).toBe(false);
    });
  });
});
