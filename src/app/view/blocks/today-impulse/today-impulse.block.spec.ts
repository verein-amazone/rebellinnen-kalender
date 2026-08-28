import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { ShakeInteractor } from '@app/interactors/feedback/shake.interactor';

import { TodayImpulseBlock } from './today-impulse.block';

const TODAY = '2027-02-05';

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
    relatedSources: [],
    ...overrides,
  };
}

class FakeDailyImpulseInteractor {
  item: ContentItemView | null = null;
  seenDays = new Set<string>();

  featuredItem(): Promise<ContentItemView | null> {
    return Promise.resolve(this.item);
  }

  isUnseen(day: string): boolean {
    return !this.seenDays.has(day);
  }

  markSeen(day: string): void {
    this.seenDays.add(day);
  }
}

/** Records greetings instead of buzzing; the real plugin has no jsdom implementation. */
class FakeHapticsInteractor {
  plays = 0;

  playArrival(): Promise<void> {
    this.plays += 1;
    return Promise.resolve();
  }
}

/** Hands the block a shake trigger the test can pull, and a stop function it can assert on. */
class FakeShakeInteractor {
  shake: (() => void) | null = null;
  stopped = 0;

  watch(onShake: () => void): Promise<() => void> {
    this.shake = onShake;
    return Promise.resolve(() => {
      this.stopped += 1;
    });
  }
}

async function setup(config: { item?: ContentItemView | null; seenToday?: boolean } = {}) {
  const daily = new FakeDailyImpulseInteractor();
  daily.item = config.item === undefined ? item() : config.item;

  const haptics = new FakeHapticsInteractor();
  const shake = new FakeShakeInteractor();
  if (config.seenToday) {
    daily.seenDays.add(TODAY);
  }

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DailyImpulseInteractor, useValue: daily },
      { provide: LocalDay, useValue: { day: signal(TODAY).asReadonly() } },
      { provide: HapticsInteractor, useValue: haptics },
      { provide: ShakeInteractor, useValue: shake },
    ],
  });

  const fixture = TestBed.createComponent(TodayImpulseBlock);
  await fixture.whenStable();

  return {
    element: fixture.nativeElement as HTMLElement,
    daily,
    haptics,
    shake,
    settle: () => fixture.whenStable(),
    destroy: () => fixture.destroy(),
  };
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

  it('announces a new impulse once, then records the day as seen', async () => {
    const { element, daily } = await setup();

    // jsdom never runs CSS animations, so the class is what there is to assert - the keyframes
    // themselves live in styles/components/arrived.css.
    expect(element.querySelector('.rk-arrived')).not.toBeNull();
    expect(daily.seenDays.has(TODAY)).toBe(true);
  });

  it("stays still once the day's impulse has already been seen", async () => {
    const { element } = await setup({ seenToday: true });

    expect(element.querySelector('.rk-arrived')).toBeNull();
  });

  it('greets a new impulse with the haptic pattern as well as the wave', async () => {
    const { haptics } = await setup();

    expect(haptics.plays).toBe(1);
  });

  it("stays silent when the day's impulse has already been seen", async () => {
    const { haptics } = await setup({ seenToday: true });

    expect(haptics.plays).toBe(0);
  });

  it('replays the greeting when the phone is shaken', async () => {
    const { element, settle, shake, haptics } = await setup({ seenToday: true });
    expect(element.querySelector('.rk-arrived')).toBeNull();

    shake.shake?.();
    // The class has to leave and come back for the animation to restart, which costs a frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();

    expect(element.querySelector('.rk-arrived')).not.toBeNull();
    expect(haptics.plays).toBe(1);
  });

  it('does not react to a shake while there is no impulse to greet', async () => {
    const { shake, haptics, settle } = await setup({ item: null });

    shake.shake?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();

    expect(haptics.plays).toBe(0);
  });

  it('stops listening for shakes when the card goes away', async () => {
    const { destroy, shake } = await setup();

    destroy();

    expect(shake.stopped).toBe(1);
  });
});
