import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import type {
  SupportServiceRegion,
  SupportServiceView,
} from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { ContentOverviewPage } from './overview.page';

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: 'Ein Bad nehmen.',
    imagePath: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    ...overrides,
  };
}

function service(overrides: Partial<SupportServiceView> = {}): SupportServiceView {
  return {
    id: 'rat-auf-draht',
    region: 'online',
    name: 'Rat auf Draht',
    teaser: 'Beratung für Kinder und Jugendliche',
    crisis: true,
    icon: '🧠',
    color: '#E92F2A',
    logoPath: null,
    actions: [
      { type: 'phone', label: 'Anrufen', uri: 'tel:147', displayValue: '147' },
      {
        type: 'chat',
        label: 'Chat',
        uri: 'https://www.rataufdraht.at/chatberatung',
        displayValue: null,
      },
    ],
    ...overrides,
  };
}

class FakeBookmarksInteractor {
  savedItems: ContentItemView[] = [];

  listSavedItems(): Promise<ContentItemView[]> {
    return Promise.resolve(this.savedItems);
  }

  toggle(contentItemId: string): Promise<void> {
    this.savedItems = this.savedItems.filter((item) => item.id !== contentItemId);
    return Promise.resolve();
  }
}

/** Answers sheet opens in the order they are configured; the sheet chrome has its own spec. */
class StubSheetService {
  readonly opens: { heading: string; data: unknown }[] = [];
  results: unknown[] = [];

  open(
    _content: unknown,
    config: { heading: string; data?: unknown },
  ): { closed: Observable<unknown> } {
    this.opens.push({ heading: config.heading, data: config.data });
    return { closed: of(this.results.shift()) };
  }
}

class FakeSupportServicesInteractor {
  services: SupportServiceView[] = [];
  regions: SupportServiceRegion[] = [];

  listAll(): Promise<SupportServiceView[]> {
    return Promise.resolve(this.services);
  }

  listRegions(): Promise<SupportServiceRegion[]> {
    return Promise.resolve(this.regions);
  }
}

async function setup(
  options: {
    items?: ContentItemView[];
    services?: SupportServiceView[];
    regions?: SupportServiceRegion[];
    queryParams?: Record<string, string>;
  } = {},
) {
  const bookmarks = new FakeBookmarksInteractor();
  bookmarks.savedItems = options.items ?? [];

  const supportServices = new FakeSupportServicesInteractor();
  supportServices.services = options.services ?? [];
  supportServices.regions = options.regions ?? [];

  const sheets = new StubSheetService();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BookmarksInteractor, useValue: bookmarks },
      { provide: SupportServicesInteractor, useValue: supportServices },
      { provide: SheetService, useValue: sheets },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(options.queryParams ?? {}) } },
      },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigate = navigate;

  const fixture = TestBed.createComponent(ContentOverviewPage);
  // `area` is bound from the query parameter by `withComponentInputBinding()` in the real app.
  fixture.componentRef.setInput('area', options.queryParams?.['area']);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    whenStable: () => fixture.whenStable(),
    navigate,
    /** Stands in for the router feeding the navigated-to `?area=` back into the input. */
    setArea: async (area: string) => {
      fixture.componentRef.setInput('area', area);
      await fixture.whenStable();
    },
    bookmarks,
    bookmarkChanges: TestBed.inject(BookmarkChanges),
    sheets,
  };
}

describe('ContentOverviewPage', () => {
  it('shows Anlaufstellen by default', async () => {
    const { element } = await setup({
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [service()],
    });

    expect(element.textContent).toContain('Rat auf Draht');
  });

  it('exposes a real ARIA tabs widget with the Anlaufstellen tab selected by default', async () => {
    const { element } = await setup();

    expect(element.querySelector('[role="tablist"]')).not.toBeNull();

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    const servicesTab = tabs.find((tab) => tab.textContent?.includes('Anlaufstellen'));
    const collectionTab = tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'));
    expect(servicesTab?.getAttribute('aria-selected')).toBe('true');
    expect(collectionTab?.getAttribute('aria-selected')).toBe('false');

    const panels = Array.from(element.querySelectorAll('[role="tabpanel"]'));
    expect(panels).toHaveLength(2);
    expect(servicesTab?.getAttribute('aria-controls')).toBe(
      panels.find((panel) => !panel.hasAttribute('inert'))?.id,
    );
  });

  it('shows only entries matching the selected region', async () => {
    const { element, whenStable } = await setup({
      regions: [
        { id: 'online', label: 'Online & Telefon' },
        { id: 'vorarlberg', label: 'Vorarlberg' },
      ],
      services: [
        service({ id: 'rat-auf-draht', region: 'online', name: 'Rat auf Draht' }),
        service({ id: 'verein-amazone', region: 'vorarlberg', name: 'Verein Amazone' }),
      ],
    });

    expect(element.textContent).toContain('Rat auf Draht');
    expect(element.textContent).not.toContain('Verein Amazone');

    const regionButtons = Array.from(element.querySelectorAll('button[role="radio"]'));
    const vorarlbergButton = regionButtons.find((button) =>
      button.textContent?.includes('Vorarlberg'),
    );
    (vorarlbergButton as HTMLButtonElement).click();
    await whenStable();

    expect(element.textContent).toContain('Verein Amazone');
    expect(element.textContent).not.toContain('Rat auf Draht');
  });

  it('shows an empty state for a region with no entries', async () => {
    const { element } = await setup({
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [],
    });

    expect(element.textContent).toContain('noch keine Anlaufstellen');
  });

  async function openCollection(
    element: HTMLElement,
    setArea: (area: string) => Promise<void>,
  ): Promise<void> {
    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'))?.click();
    await setArea('collection');
  }

  it('shows every bookmarked item in Meine Sammlung, linking back to the content tab', async () => {
    const { element, setArea } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });

    await openCollection(element, setArea);

    const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="/content/"]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/wi-01?returnTo=%2Fcontent%3Farea%3Dcollection%26filter%3Dall',
    ]);
    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('shows the empty-collection state when nothing is bookmarked', async () => {
    const { element, setArea } = await setup({ items: [] });

    await openCollection(element, setArea);

    expect(element.textContent).toContain('Deine Sammlung ist noch leer');
  });

  it('filters the collection by content type', async () => {
    const { element, whenStable, setArea } = await setup({
      items: [
        item({ id: 'wi-01', kind: 'wissensimpulse', title: 'Wissensimpuls' }),
        item({ id: 'reb-01', kind: 'rebellin', title: 'Eine Rebellin' }),
      ],
    });

    await openCollection(element, setArea);
    expect(element.textContent).toContain('Wissensimpuls');
    expect(element.textContent).toContain('Eine Rebellin');

    const filterButtons = Array.from(element.querySelectorAll('button[role="radio"]'));
    const rebellinFilter = filterButtons.find((button) =>
      button.textContent?.includes('Rebell*in'),
    );
    (rebellinFilter as HTMLButtonElement).click();
    await whenStable();

    expect(element.textContent).toContain('Eine Rebellin');
    expect(element.textContent).not.toContain('Wissensimpuls');
  });

  it('asks for confirmation before removing an item, then removes it once confirmed', async () => {
    const { element, whenStable, setArea, bookmarks, bookmarkChanges, sheets } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });
    sheets.results = [true];

    await openCollection(element, setArea);
    const removeButton = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Aus Sammlung entfernen'),
    );
    (removeButton as HTMLButtonElement).click();
    await whenStable();

    expect(sheets.opens[0]?.heading).toContain('entfernen');
    // The fake stands in for `BookmarksInteractor.toggle`, which normally notifies
    // `BookmarkChanges` itself - the resource only reloads once that happens.
    bookmarks.savedItems = [];
    bookmarkChanges.notify();
    await whenStable();

    expect(element.textContent).toContain('Deine Sammlung ist noch leer');
  });

  it('keeps the item when the removal confirmation is declined', async () => {
    const { element, whenStable, setArea, bookmarks, sheets } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });
    sheets.results = [false];

    await openCollection(element, setArea);
    const removeButton = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Aus Sammlung entfernen'),
    );
    (removeButton as HTMLButtonElement).click();
    await whenStable();

    expect(bookmarks.savedItems).toHaveLength(1);
    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('restores the Meine Sammlung tab and filter from the returnTo query params', async () => {
    const { element } = await setup({
      items: [
        item({ id: 'wi-01', kind: 'wissensimpulse', title: 'Wissensimpuls' }),
        item({ id: 'reb-01', kind: 'rebellin', title: 'Eine Rebellin' }),
      ],
      queryParams: { area: 'collection', filter: 'rebellin' },
    });

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(
      tabs
        .find((tab) => tab.textContent?.includes('Meine Sammlung'))
        ?.getAttribute('aria-selected'),
    ).toBe('true');
    expect(element.textContent).toContain('Eine Rebellin');
    expect(element.textContent).not.toContain('Wissensimpuls');
  });

  it('reloads the collection when a bookmark changes elsewhere', async () => {
    const { element, whenStable, setArea, bookmarks, bookmarkChanges } = await setup({ items: [] });

    await openCollection(element, setArea);
    expect(element.textContent).toContain('Deine Sammlung ist noch leer');

    bookmarks.savedItems = [item({ id: 'wi-01', title: 'Was tut dir gut?' })];
    bookmarkChanges.notify();
    await whenStable();

    expect(element.textContent).toContain('Was tut dir gut?');
  });
});
