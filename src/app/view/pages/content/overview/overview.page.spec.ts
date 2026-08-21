import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';

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
    ...overrides,
  };
}

class FakeContentItemsInteractor {
  items: ContentItemView[] = [];

  listAll(): Promise<ContentItemView[]> {
    return Promise.resolve(this.items);
  }
}

async function setup(items: ContentItemView[] = []) {
  const contentItems = new FakeContentItemsInteractor();
  contentItems.items = items;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: ContentItemsInteractor, useValue: contentItems }],
  });

  const fixture = TestBed.createComponent(ContentOverviewPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('ContentOverviewPage', () => {
  it('lists every content item with a link to its detail page', async () => {
    const { element } = await setup([
      item({ id: 'wi-01', title: 'Was tut dir gut?' }),
      item({ id: 'reb-01', kind: 'rebellin', title: 'Ada Lovelace' }),
    ]);

    const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="/content/"]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/wi-01?returnTo=%2Fcontent',
      '/content/reb-01?returnTo=%2Fcontent',
    ]);
    expect(element.textContent).toContain('Was tut dir gut?');
    expect(element.textContent).toContain('Ada Lovelace');
  });

  it('shows a fallback when there is no content yet', async () => {
    const { element } = await setup([]);

    expect(element.textContent).toContain('Noch keine Inhalte');
  });
});
