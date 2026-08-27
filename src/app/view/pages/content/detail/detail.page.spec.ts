import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { BookmarksInteractor } from '@app/interactors/saved-content/bookmarks.interactor';

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

async function setup(
  config: { item?: ContentItemView | null; bookmarked?: boolean; returnTo?: string } = {},
) {
  const contentItems = new FakeContentItemsInteractor();
  contentItems.item = config.item === undefined ? item() : config.item;

  const bookmarks = new FakeBookmarksInteractor();
  if (config.bookmarked && contentItems.item) {
    bookmarks.bookmarked.add(contentItems.item.id);
  }

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContentItemsInteractor, useValue: contentItems },
      { provide: BookmarksInteractor, useValue: bookmarks },
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

  it('toggles the bookmark when the button is pressed', async () => {
    const { element, settle } = await setup({ bookmarked: false });
    const button = element.querySelector<HTMLButtonElement>('button[aria-pressed]')!;

    button.click();
    await settle();

    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows an estimated reading time for the body', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Min. Lesezeit');
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
