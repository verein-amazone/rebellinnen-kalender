import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { ContentDetailPage } from './detail.page';

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

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContentItemsInteractor, useValue: contentItems },
      { provide: BookmarksInteractor, useValue: bookmarks },
      { provide: SheetService, useValue: sheets },
    ],
  });

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

    expect(navigateByUrl).toHaveBeenCalledWith('/content', { replaceUrl: true });
  });

  it('returns to the origin the link carried in ?returnTo=', async () => {
    // The same item is reachable from Today, from Meine Sammlung and from the debug catalog, so
    // the origin travels in the URL rather than being read back out of the browser history.
    const { dismiss, settle, navigateByUrl } = await setup({
      returnTo: '/settings/content-catalog',
    });

    dismiss();
    await settle();

    expect(navigateByUrl).toHaveBeenCalledWith('/settings/content-catalog', { replaceUrl: true });
  });

  it('shows the title, type label and body of the item', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Was tut dir gut?');
    expect(element.textContent).toContain('Wissen & Impulse');
    expect(element.textContent).toContain('Ein Bad nehmen.');
  });

  it('labels a Rebell*in item accordingly', async () => {
    const { element } = await setup({ item: item({ kind: 'rebellin', title: 'Ada Lovelace' }) });

    expect(element.textContent).toContain('Rebell*in');
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
    expect(navigateByUrl).toHaveBeenCalledWith('/content?area=collection', { replaceUrl: true });
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

  it('shows related sources with their publisher domain when present', async () => {
    const { element } = await setup({
      item: item({
        relatedSources: [{ title: 'Mehr erfahren', url: 'https://www.example.org/artikel' }],
      }),
    });

    expect(element.textContent).toContain('Mehr zum Thema');
    expect(element.textContent).toContain('Mehr erfahren');
    expect(element.textContent).toContain('example.org');
  });

  it('omits the related-sources section when there are none', async () => {
    const { element } = await setup({ item: item({ relatedSources: [] }) });

    expect(element.textContent).not.toContain('Mehr zum Thema');
  });
});
