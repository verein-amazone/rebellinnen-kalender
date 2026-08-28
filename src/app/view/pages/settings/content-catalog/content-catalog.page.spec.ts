import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';

import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';

import { ContentCatalogPage } from './content-catalog.page';

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
  items: ContentItemView[] = [];

  listAll(): Promise<ContentItemView[]> {
    return Promise.resolve(this.items);
  }
}

const TODAY = '2027-02-05';

/** Stands in for the store-backed interactor; only the day's pick matters here. */
class FakeDailyImpulseInteractor {
  featuredId: string | null = null;

  featuredItemId(): string | null {
    return this.featuredId;
  }

  featureItem(day: string, itemId: string): void {
    this.featured.push({ day, itemId });
    this.featuredId = itemId;
  }

  readonly featured: { day: string; itemId: string }[] = [];
}

async function setup(items: ContentItemView[] = [], featuredId: string | null = null) {
  const contentItems = new FakeContentItemsInteractor();
  contentItems.items = items;

  const daily = new FakeDailyImpulseInteractor();
  daily.featuredId = featuredId;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ContentItemsInteractor, useValue: contentItems },
      { provide: DailyImpulseInteractor, useValue: daily },
      { provide: LocalDay, useValue: { day: signal(TODAY).asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(ContentCatalogPage);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    settle: () => fixture.whenStable(),
    daily,
  };
}

describe('ContentCatalogPage', () => {
  it('lists every content item, linking back to itself as the return context', async () => {
    const { element } = await setup([item({ id: 'wi-01', title: 'Was tut dir gut?' })]);

    const links = [...element.querySelectorAll<HTMLAnchorElement>('a[href^="/content/"]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/content/wi-01?returnTo=%2Fsettings%2Fcontent-catalog',
    ]);
    expect(element.textContent).toContain('Was tut dir gut?');
  });

  it('shows a fallback when there is no content yet', async () => {
    const { element } = await setup([]);

    expect(element.textContent).toContain('Noch keine Inhalte');
  });

  it('marks the item currently featured on Today, by check icon and aria-checked', async () => {
    const { element } = await setup(
      [item({ id: 'wi-01', title: 'Erster' }), item({ id: 'wi-02', title: 'Zweiter' })],
      'wi-02',
    );

    const radios = [...element.querySelectorAll('button[role="radio"]')];
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(radios[1].querySelector('svg')).not.toBeNull();
    expect(radios[0].querySelector('svg')).toBeNull();
  });

  it('features the tapped item on Today', async () => {
    const { element, settle, daily } = await setup(
      [item({ id: 'wi-01', title: 'Erster' }), item({ id: 'wi-02', title: 'Zweiter' })],
      'wi-01',
    );

    element.querySelectorAll<HTMLButtonElement>('button[role="radio"]')[1].click();
    await settle();

    expect(daily.featured).toEqual([{ day: TODAY, itemId: 'wi-02' }]);
    const radios = [...element.querySelectorAll('button[role="radio"]')];
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });
});
