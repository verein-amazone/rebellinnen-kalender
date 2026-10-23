import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import type { SupportServiceView } from '@app/interactors/support-services/support-service.vm';
import { SupportServicesInteractor } from '@app/interactors/support-services/support-services.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { ContentDetailPage } from './detail.page';
import { RETURN_NAVIGATION } from '@app/view/scaffolds/main-navigation/scroll-memory';

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
    video: null,
    supportServiceIds: null,
    ...overrides,
  };
}

class FakeContentItemsInteractor {
  item: ContentItemView | null = null;

  findById(): Promise<ContentItemView | null> {
    return Promise.resolve(this.item);
  }
}

class FakeBookmarksInteractor {
  bookmarked = new Set<string>();

  isBookmarked(id: string): Promise<boolean> {
    return Promise.resolve(this.bookmarked.has(id));
  }

  toggle(id: string): Promise<void> {
    if (this.bookmarked.has(id)) {
      this.bookmarked.delete(id);
    } else {
      this.bookmarked.add(id);
    }
    return Promise.resolve();
  }
}

class FakeSupportServicesInteractor {
  services: SupportServiceView[] = [];

  listByIds(ids: readonly string[]): Promise<SupportServiceView[]> {
    return Promise.resolve(
      ids.flatMap((id) => this.services.find((entry) => entry.id === id) ?? []),
    );
  }
}

function service(id: string, name: string): SupportServiceView {
  return { id, region: 'online', name, teaser: `${name} berät dich`, icon: '🧠', actions: [] };
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

async function setup(
  config: {
    item?: ContentItemView | null;
    bookmarked?: boolean;
    returnTo?: string;
    confirmations?: unknown[];
    services?: SupportServiceView[];
  } = {},
) {
  const contentItems = new FakeContentItemsInteractor();
  contentItems.item = config.item === undefined ? item() : config.item;

  const bookmarks = new FakeBookmarksInteractor();
  if (config.bookmarked && contentItems.item) {
    bookmarks.bookmarked.add(contentItems.item.id);
  }

  const sheets = new StubSheetService();
  sheets.results = config.confirmations ?? [];

  const supportServices = new FakeSupportServicesInteractor();
  supportServices.services = config.services ?? [];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContentItemsInteractor, useValue: contentItems },
      { provide: BookmarksInteractor, useValue: bookmarks },
      { provide: SheetService, useValue: sheets },
      { provide: SupportServicesInteractor, useValue: supportServices },
    ],
  });

  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigate = navigate;
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  TestBed.inject(Router).navigateByUrl = navigateByUrl;

  const fixture = TestBed.createComponent(ContentDetailPage);
  fixture.componentRef.setInput('id', contentItems.item?.id ?? 'unknown');
  if (config.returnTo !== undefined) {
    fixture.componentRef.setInput('returnTo', config.returnTo);
  }
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    navigate,
    navigateByUrl,
    bookmarks,
    sheets,
    toggle: () => element.querySelector<HTMLButtonElement>('button[aria-pressed]')!.click(),
    settle: () => fixture.whenStable(),
    // The scaffold's own dismiss button, identified by its fixed position as the header's first
    // `.rk-icon-button` - the bookmark toggle is a projected header action and comes after it.
    dismiss: () => element.querySelector<HTMLButtonElement>('header .rk-icon-button')!.click(),
  };
}

describe('ContentDetailPage', () => {
  it('returns to the content overview when no origin was passed in', async () => {
    const { dismiss, settle, navigateByUrl } = await setup();

    dismiss();
    await settle();

    expect(navigateByUrl).toHaveBeenCalledWith('/content', RETURN_NAVIGATION);
  });

  it('returns to the origin the link carried in ?returnTo=', async () => {
    // The same item is reachable from Today, from Meine Sammlung and from the debug catalog, so
    // the origin travels in the URL rather than being read back out of the browser history.
    const { dismiss, settle, navigateByUrl } = await setup({
      returnTo: '/settings/content-catalog',
    });

    dismiss();
    await settle();

    expect(navigateByUrl).toHaveBeenCalledWith('/settings/content-catalog', RETURN_NAVIGATION);
  });

  it('shows the title, type label and body of the item', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Was tut dir gut?');
    expect(element.textContent).toContain('Wissen');
    expect(element.textContent).toContain('Ein Bad nehmen.');
  });

  it('labels a Rebell*innen item accordingly', async () => {
    const { element } = await setup({ item: item({ kind: 'rebellin', title: 'Ada Lovelace' }) });

    expect(element.textContent).toContain('Rebell*innen');
  });

  it('shows the teaser above the image', async () => {
    const { element } = await setup({
      item: item({ imagePath: '/content/images/was-tut-dir-gut.webp', imageAlt: 'Eine Badewanne' }),
    });

    const teaser = [...element.querySelectorAll('p')].find((paragraph) =>
      paragraph.textContent?.includes('Wir haben ein paar Ideen für dich!'),
    );
    const image = element.querySelector('img');

    expect(teaser).toBeDefined();
    expect(image).not.toBeNull();
    // `DOCUMENT_POSITION_FOLLOWING`: the image comes after the teaser in the document.
    expect(teaser!.compareDocumentPosition(image!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('describes the image instead of crediting it in the alt text', async () => {
    const { element } = await setup({
      item: item({
        imagePath: '/content/images/hedy-lamarr.webp',
        imageAlt: 'Schwarz-weißes Porträtfoto von Hedy Lamarr',
        imageAttribution: 'Los Angeles Times, Public Domain',
      }),
    });

    expect(element.querySelector('img')?.getAttribute('alt')).toBe(
      'Schwarz-weißes Porträtfoto von Hedy Lamarr',
    );
    // The credit is a caption, and stays one.
    expect(element.textContent).toContain('Bild: Los Angeles Times, Public Domain');
  });

  it('shows a graceful fallback when the item cannot be found', async () => {
    const { element } = await setup({ item: null });

    expect(element.textContent).not.toContain('undefined');
    expect(element.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('shows the bookmark toggle reflecting the current bookmark state', async () => {
    const { element } = await setup({ bookmarked: true });

    const button = element.querySelector('button[aria-pressed]');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('asks before removing the item from the collection and then leaves for the collection', async () => {
    const { toggle, settle, bookmarks, sheets, navigateByUrl } = await setup({
      bookmarked: true,
      confirmations: [true],
    });

    toggle();
    await settle();

    expect(sheets.opens[0]?.heading).toContain('entfernen');
    expect(bookmarks.bookmarked.has('wi-01')).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/content?area=collection', RETURN_NAVIGATION);
  });

  it('keeps the item and stays on the page when the removal is declined', async () => {
    const { toggle, settle, element, bookmarks, navigateByUrl } = await setup({
      bookmarked: true,
      confirmations: [false],
    });

    toggle();
    await settle();

    expect(bookmarks.bookmarked.has('wi-01')).toBe(true);
    expect(element.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('saves without asking, since saving is instantly reversible', async () => {
    const { toggle, settle, bookmarks, sheets } = await setup({ bookmarked: false });

    toggle();
    await settle();

    expect(sheets.opens).toHaveLength(0);
    expect(bookmarks.bookmarked.has('wi-01')).toBe(true);
  });

  it('toggles the bookmark when the button is pressed', async () => {
    const { element, settle } = await setup({ bookmarked: false });
    const button = element.querySelector<HTMLButtonElement>('button[aria-pressed]')!;

    button.click();
    await settle();

    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks a link to a known platform with its symbol, and any other with the external-link icon', async () => {
    const { element } = await setup({
      item: item({
        relatedSources: [
          {
            title: '@astro_christina',
            subtitle: 'Instagram',
            url: 'https://www.instagram.com/astro_christina/',
          },
          { title: 'Christina Koch', subtitle: 'NASA', url: 'https://www.nasa.gov/' },
        ],
      }),
    });

    const [instagram, nasa] = [...element.querySelectorAll('section a')];
    expect(instagram?.querySelector('svg[lucideCamera]')).not.toBeNull();
    expect(instagram?.querySelector('svg[lucideExternalLink]')).toBeNull();
    expect(nasa?.querySelector('svg[lucideExternalLink]')).not.toBeNull();
  });

  it('lists related sources in one card, each a link with its title and optional subtitle', async () => {
    const { element } = await setup({
      item: item({
        relatedSources: [
          {
            title: 'Mehr erfahren',
            subtitle: 'Ein Artikel',
            url: 'https://www.example.org/artikel',
          },
          { title: 'Studie', subtitle: null, url: 'https://example.com/studie' },
        ],
      }),
    });

    const card = element.querySelector('section[aria-labelledby="related-sources-heading"]');
    expect(card?.querySelector('h2')?.textContent).toContain('Mehr zum Thema');

    const links = [...(card?.querySelectorAll('a') ?? [])];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.example.org/artikel',
      'https://example.com/studie',
    ]);
    expect(links[0]?.textContent).toContain('Mehr erfahren');
    expect(links[0]?.textContent).toContain('Ein Artikel');
    expect(links[1]?.textContent).toContain('Studie');
    expect(links[1]?.querySelectorAll('.text-sm')).toHaveLength(0);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(link.textContent).toContain('öffnet in einem neuen Fenster');
    }
  });

  it('omits the related-sources section when there are none', async () => {
    const { element } = await setup({ item: item({ relatedSources: [] }) });

    expect(element.textContent).not.toContain('Mehr zum Thema');
  });

  describe('with a video', () => {
    const video = { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' } as const;

    it('shows the cover in the picture’s place and labels the item as a video', async () => {
      const { element } = await setup({
        item: item({ video, imagePath: '/content/images/body.webp', imageAlt: 'Standbild' }),
      });

      expect(element.querySelector('app-video-cover')).not.toBeNull();
      expect(element.querySelector('img[alt="Standbild"]')).toBeNull();
      expect(
        [...element.querySelectorAll('.rk-pill')].map((pill) => pill.textContent?.trim()),
      ).toContain('Video');
    });

    it('opens the video on its own screen, which comes back here', async () => {
      const { element, navigate, settle } = await setup({
        item: item({ video }),
        returnTo: '/today',
      });

      element.querySelector<HTMLButtonElement>('.rk-video-poster')!.click();
      await settle();

      expect(navigate).toHaveBeenCalledWith(['/content', 'wi-01', 'video'], {
        queryParams: { returnTo: '/content/wi-01?returnTo=%2Ftoday' },
      });
    });
  });

  describe('pointing to Anlaufstellen', () => {
    function rows(element: HTMLElement): { text: string; href: string | null }[] {
      return [
        ...element.querySelectorAll<HTMLAnchorElement>(
          'section[aria-labelledby="support-services-heading"] a',
        ),
      ].map(
        // The name: the emoji is decoration, and the teaser is the row's second line.
        (link) => ({
          text: (link.querySelector('.font-semibold') ?? link).textContent?.trim() ?? '',
          href: link.getAttribute('href'),
        }),
      );
    }

    it('shows no card for an item that points nowhere', async () => {
      const { element } = await setup({ item: item({ supportServiceIds: null }) });

      expect(element.querySelector('#support-services-heading')).toBeNull();
    });

    it('links the whole Anlaufstellen page for an empty list', async () => {
      const { element } = await setup({ item: item({ supportServiceIds: [] }) });

      expect(rows(element)).toEqual([
        { text: 'Anlaufstellen ansehen', href: '/content?area=services' },
      ]);
    });

    it('lists the named entries, each opening on its own card, then all of them', async () => {
      const { element } = await setup({
        item: item({ supportServiceIds: ['hotline', 'gone', 'rat-auf-draht'] }),
        services: [service('rat-auf-draht', 'Rat auf Draht'), service('hotline', 'Hotline')],
      });

      expect(rows(element)).toEqual([
        { text: 'Hotline', href: '/content?area=services&service=hotline' },
        { text: 'Rat auf Draht', href: '/content?area=services&service=rat-auf-draht' },
        { text: 'Alle Anlaufstellen', href: '/content?area=services' },
      ]);
    });
  });
});
