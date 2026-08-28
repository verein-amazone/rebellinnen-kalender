import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { BookmarkChanges } from '@app/cross-cutting/infrastructure/bookmark-changes';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import type {
  SupportServiceRegion,
  SupportServiceView,
} from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';

import { ContentOverviewPage } from './overview.page';

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: 'Ein Bad nehmen.',
    imagePath: null,
    imageAlt: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    dailyRender: 'teaser',
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

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: BookmarksInteractor, useValue: bookmarks },
      { provide: SupportServicesInteractor, useValue: supportServices },
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
  };
}

describe('ContentOverviewPage', () => {
  it('shows Meine Sammlung by default', async () => {
    const { element } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });

    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('exposes a real ARIA tabs widget with the Meine Sammlung tab selected by default', async () => {
    const { element } = await setup();

    expect(element.querySelector('[role="tablist"]')).not.toBeNull();

    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    const servicesTab = tabs.find((tab) => tab.textContent?.includes('Anlaufstellen'));
    const collectionTab = tabs.find((tab) => tab.textContent?.includes('Meine Sammlung'));
    expect(collectionTab?.getAttribute('aria-selected')).toBe('true');
    expect(servicesTab?.getAttribute('aria-selected')).toBe('false');

    // Meine Sammlung also comes first in the tab list itself, not only in the selection.
    expect(tabs[0]).toBe(collectionTab);

    const panels = Array.from(element.querySelectorAll('[role="tabpanel"]'));
    expect(panels).toHaveLength(2);
    expect(collectionTab?.getAttribute('aria-controls')).toBe(
      panels.find((panel) => !panel.hasAttribute('inert'))?.id,
    );
  });

  it('shows only entries matching the selected region', async () => {
    const { element, whenStable } = await setup({
      queryParams: { area: 'services' },
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
      queryParams: { area: 'services' },
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [],
    });

    expect(element.textContent).toContain('noch keine Anlaufstellen');
  });

  /** Anlaufstellen is the second tab now, so the services tests have to switch to it. */
  async function openServices(
    element: HTMLElement,
    setArea: (area: string) => Promise<void>,
  ): Promise<void> {
    const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    tabs.find((tab) => tab.textContent?.includes('Anlaufstellen'))?.click();
    await setArea('services');
  }

  it('switches to Anlaufstellen when its tab is tapped', async () => {
    const { element, setArea } = await setup({
      regions: [{ id: 'online', label: 'Online & Telefon' }],
      services: [service()],
    });

    await openServices(element, setArea);

    expect(element.textContent).toContain('Rat auf Draht');
  });

  it('shows every bookmarked item in Meine Sammlung, linking back to the content tab', async () => {
    const { element } = await setup({
      items: [item({ id: 'wi-01', title: 'Was tut dir gut?' })],
    });

    const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="/content/"]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/wi-01?returnTo=%2Fcontent%3Farea%3Dcollection',
    ]);
    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('shows the empty-collection state when nothing is bookmarked', async () => {
    const { element } = await setup({ items: [] });

    expect(element.textContent).toContain('Deine Sammlung ist noch leer');
  });

  function kindFilter(element: HTMLElement, label: string): HTMLButtonElement {
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    return buttons.find((button) => button.textContent?.includes(label))!;
  }

  it('shows every content type by default and switches one off independently', async () => {
    const { element, whenStable } = await setup({
      items: [
        item({ id: 'wi-01', kind: 'wissensimpulse', title: 'Wissensimpuls' }),
        item({ id: 'reb-01', kind: 'rebellin', title: 'Eine Rebellin' }),
      ],
    });

    expect(kindFilter(element, 'Wissen & Impulse').getAttribute('aria-pressed')).toBe('true');
    expect(kindFilter(element, 'Rebell*in').getAttribute('aria-pressed')).toBe('true');
    expect(element.textContent).toContain('Wissensimpuls');
    expect(element.textContent).toContain('Eine Rebellin');

    kindFilter(element, 'Wissen & Impulse').click();
    await whenStable();

    expect(kindFilter(element, 'Wissen & Impulse').getAttribute('aria-pressed')).toBe('false');
    expect(element.textContent).toContain('Eine Rebellin');
    expect(element.textContent).not.toContain('Wissensimpuls');
  });

  it('explains that the filter, not the collection, is empty when every type is switched off', async () => {
    const { element, whenStable } = await setup({
      items: [item({ id: 'wi-01', kind: 'wissensimpulse', title: 'Wissensimpuls' })],
    });

    kindFilter(element, 'Wissen & Impulse').click();
    kindFilter(element, 'Rebell*in').click();
    await whenStable();

    expect(element.textContent).toContain('Alle Kategorien sind ausgeblendet');
    expect(element.textContent).not.toContain('Deine Sammlung ist noch leer');
  });

  it('restores the tab and the kind filter from the returnTo query params', async () => {
    const { element } = await setup({
      items: [
        item({ id: 'wi-01', kind: 'wissensimpulse', title: 'Wissensimpuls' }),
        item({ id: 'reb-01', kind: 'rebellin', title: 'Eine Rebellin' }),
      ],
      queryParams: { area: 'collection', hidden: 'wissensimpulse' },
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
    const { element, whenStable, bookmarks, bookmarkChanges } = await setup({ items: [] });

    expect(element.textContent).toContain('Deine Sammlung ist noch leer');

    bookmarks.savedItems = [item({ id: 'wi-01', title: 'Was tut dir gut?' })];
    bookmarkChanges.notify();
    await whenStable();

    expect(element.textContent).toContain('Was tut dir gut?');
  });
});
