import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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

async function setup(config: { item?: ContentItemView | null; bookmarked?: boolean } = {}) {
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

  const fixture = TestBed.createComponent(ContentDetailPage);
  fixture.componentRef.setInput('id', contentItems.item?.id ?? 'unknown');
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, settle: () => fixture.whenStable() };
}

describe('ContentDetailPage', () => {
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
});
