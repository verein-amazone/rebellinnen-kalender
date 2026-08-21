import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';

import { TodayImpulseBlock } from './today-impulse.block';

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-01',
    kind: 'wissensimpulse',
    title: 'Was tut dir gut?',
    teaser: 'Wir haben ein paar Ideen für dich!',
    bodyMarkdown: 'Text',
    imagePath: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    ...overrides,
  };
}

class FakeDailyImpulseInteractor {
  item: ContentItemView | null = null;

  featuredItem(): Promise<ContentItemView | null> {
    return Promise.resolve(this.item);
  }
}

async function setup(config: { item?: ContentItemView | null } = {}) {
  const daily = new FakeDailyImpulseInteractor();
  daily.item = config.item === undefined ? item() : config.item;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DailyImpulseInteractor, useValue: daily },
      { provide: LocalDay, useValue: { day: signal('2027-02-05').asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(TodayImpulseBlock);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('TodayImpulseBlock', () => {
  it('shows the fallback message when there is no eligible content', async () => {
    const { element } = await setup({ item: null });

    expect(element.textContent).toContain('Heute gibt es noch keinen Tagesimpuls.');
  });

  it('shows the title and teaser of the featured item', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Was tut dir gut?');
    expect(element.textContent).toContain('Wir haben ein paar Ideen für dich!');
  });

  it('labels a Wissensimpulse item as "Wissen & Impulse", not by colour alone', async () => {
    const { element } = await setup({ item: item({ kind: 'wissensimpulse' }) });

    expect(element.textContent).toContain('Wissen & Impulse');
  });

  it('labels a Rebell*in item as "Rebell*in"', async () => {
    const { element } = await setup({ item: item({ kind: 'rebellin', title: 'Ada Lovelace' }) });

    expect(element.textContent).toContain('Rebell*in');
  });

  it('shows a "Mehr lesen" hint', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Mehr lesen');
  });

  it('is one link covering the whole card, into the item detail route', async () => {
    const { element } = await setup({ item: item({ id: 'wi-07' }) });

    const links = element.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('wi-07');
    expect(links[0].textContent).toContain('Was tut dir gut?');
    expect(links[0].textContent).toContain('Mehr lesen');
  });
});
