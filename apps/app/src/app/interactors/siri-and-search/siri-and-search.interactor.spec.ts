import { TestBed } from '@angular/core/testing';

import {
  DeviceSiriAndSearch,
  type SearchDomain,
  type SearchEntry,
} from '@app/cross-cutting/infrastructure/siri-and-search';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import type { SupportServiceView } from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';

import { SiriAndSearchInteractor } from './siri-and-search.interactor';

class FakeDevice {
  supported = true;
  failing: SearchDomain | null = null;
  calls: string[] = [];
  domains = new Map<SearchDomain, readonly SearchEntry[]>();

  isSupported(): boolean {
    return this.supported;
  }

  replaceDomain(domain: SearchDomain, entries: readonly SearchEntry[]): Promise<void> {
    this.calls.push(`replace ${domain}`);
    if (this.failing === domain) {
      return Promise.reject(new Error('index unavailable'));
    }
    this.domains.set(domain, entries);
    return Promise.resolve();
  }

  deleteAll(): Promise<void> {
    this.calls.push('delete all');
    this.domains.clear();
    return Promise.resolve();
  }
}

function service(id: string): SupportServiceView {
  return { id, region: 'online', name: `Name ${id}`, teaser: 'Teaser', icon: '📞', actions: [] };
}

function item(id: string): ContentItemView {
  return {
    id,
    kind: 'wissensimpulse',
    title: `Titel ${id}`,
    teaser: 'Teaser',
    bodyMarkdown: '',
    imagePath: null,
    imageAlt: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    video: null,
    supportServiceIds: null,
  };
}

describe('SiriAndSearchInteractor', () => {
  let device: FakeDevice;
  let services: SupportServiceView[];
  let saved: ContentItemView[];

  beforeEach(() => {
    device = new FakeDevice();
    services = [service('rat-auf-draht'), service('telefonseelsorge')];
    saved = [item('wi-01')];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: DeviceSiriAndSearch, useValue: device },
        {
          provide: SupportServicesInteractor,
          useValue: { listAll: () => Promise.resolve(services) },
        },
        {
          provide: BookmarksInteractor,
          useValue: { listSavedItems: () => Promise.resolve(saved) },
        },
      ],
    });
  });

  function interactor(): SiriAndSearchInteractor {
    return TestBed.inject(SiriAndSearchInteractor);
  }

  function ids(domain: SearchDomain): string[] | undefined {
    return device.domains.get(domain)?.map((entry) => entry.id);
  }

  it('lists every Anlaufstelle and every bookmarked item', async () => {
    await interactor().sync();

    expect(ids('support-services')).toEqual(['service:rat-auf-draht', 'service:telefonseelsorge']);
    expect(ids('content-bookmarks')).toEqual(['content:wi-01']);
  });

  it('follows the bookmarks, dropping one that is gone', async () => {
    const siriAndSearch = interactor();
    await siriAndSearch.sync();

    saved = [item('reb-02')];
    await siriAndSearch.sync();

    expect(ids('content-bookmarks')).toEqual(['content:reb-02']);
  });

  it('runs a sync requested during another one once more afterwards, not in parallel', async () => {
    const siriAndSearch = interactor();

    const first = siriAndSearch.sync();
    const second = siriAndSearch.sync();
    await Promise.all([first, second]);

    expect(device.calls).toEqual([
      'replace support-services',
      'replace content-bookmarks',
      'replace support-services',
      'replace content-bookmarks',
    ]);
  });

  it('keeps the other domain going when one fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    device.failing = 'support-services';

    await interactor().sync();

    expect(ids('content-bookmarks')).toEqual(['content:wi-01']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps going when a catalog cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.overrideProvider(SupportServicesInteractor, {
      useValue: { listAll: () => Promise.reject(new Error('catalog unreadable')) },
    });

    await interactor().sync();

    expect(ids('content-bookmarks')).toEqual(['content:wi-01']);
    warn.mockRestore();
  });

  it('does nothing where iOS search does not exist', async () => {
    device.supported = false;

    await interactor().sync();

    expect(device.calls).toEqual([]);
  });

  it('clears everything it indexed', async () => {
    const siriAndSearch = interactor();
    await siriAndSearch.sync();

    await siriAndSearch.clearAll();

    expect(device.domains.size).toBe(0);
  });
});
