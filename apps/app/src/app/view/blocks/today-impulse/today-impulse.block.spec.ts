import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import {
  ShakeInteractor,
  type ShakeWatchOptions,
} from '@app/interactors/feedback/shake.interactor';

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

/**
 * Stands in for the greeting decision: greets until marked, again after `reopen()`, never when
 * `enabled` is off. The real rules (per opening, per day, never) are covered by the interactor's
 * own spec; a signal, like the real store, so the block's effect notices a reopening.
 */
class FakeDailyImpulseInteractor {
  item: ContentItemView | null = null;
  enabled = true;
  readonly greeted = signal(false);
  greetedDays: string[] = [];

  featuredItem(): Promise<ContentItemView | null> {
    return Promise.resolve(this.item);
  }

  shouldGreet(): boolean {
    return this.enabled && !this.greeted();
  }

  greetingEnabled(): boolean {
    return this.enabled;
  }

  markGreeted(day: string): void {
    this.greeted.set(true);
    this.greetedDays.push(day);
  }

  reopen(): void {
    this.greeted.set(false);
  }
}

/** Records greetings instead of buzzing; the real plugin has no jsdom implementation. */
class FakeHapticsInteractor {
  plays = 0;
  lastOptions: { readonly replay?: boolean } | null = null;

  playArrival(options: { readonly replay?: boolean } = {}): Promise<void> {
    this.plays += 1;
    this.lastOptions = options;
    return Promise.resolve();
  }
}

/** Hands the block a shake trigger the test can pull, and a stop function it can assert on. */
class FakeShakeInteractor {
  shake: (() => void) | null = null;
  stopped = 0;
  options: ShakeWatchOptions | null = null;
  /** Holds the sensor start back until `start()`, like a device that is slow to begin. */
  slow = false;
  private started: (() => void) | null = null;

  watch(onShake: () => void, options: ShakeWatchOptions = {}): Promise<() => void> {
    this.shake = onShake;
    this.options = options;
    const stop = () => {
      this.stopped += 1;
    };
    if (!this.slow) {
      return Promise.resolve(stop);
    }
    return new Promise((resolve) => (this.started = () => resolve(stop)));
  }

  start(): void {
    this.started?.();
  }
}

async function setup(
  config: {
    item?: ContentItemView | null;
    alreadyGreeted?: boolean;
    greetingOff?: boolean;
    slowShakeSensor?: boolean;
  } = {},
) {
  const daily = new FakeDailyImpulseInteractor();
  daily.item = config.item === undefined ? item() : config.item;
  daily.enabled = config.greetingOff !== true;

  const haptics = new FakeHapticsInteractor();
  const shake = new FakeShakeInteractor();
  shake.slow = config.slowShakeSensor === true;
  if (config.alreadyGreeted) {
    daily.greeted.set(true);
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

  it('names itself „Für dich“, and does not repeat the content type here', async () => {
    const { element } = await setup({ item: item({ kind: 'rebellin', title: 'Ada Lovelace' }) });

    // The label is the heading the surrounding section is named by, styled as a pill.
    const heading = element.querySelector('h2#impulse-heading');
    expect(heading?.textContent).toContain('Für dich');
    expect(heading?.classList.contains('rk-pill-solid')).toBe(true);

    // The content type lives on the detail screen; on Today it competed with the one label that
    // matters.
    expect(element.textContent).not.toContain('Rebell*in');
    expect(element.textContent).not.toContain('Wissen & Impulse');
  });

  it('leads with the image, its description and no teaser', async () => {
    const { element } = await setup({
      item: item({
        imagePath: '/content/images/ada-lovelace.webp',
        imageAlt: 'Gemaltes Porträt von Ada Lovelace',
        title: 'Ada Lovelace',
      }),
    });

    const image = element.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/content/images/ada-lovelace.webp');
    expect(image?.getAttribute('alt')).toBe('Gemaltes Porträt von Ada Lovelace');
    expect(element.textContent).toContain('Ada Lovelace');
    expect(element.textContent).not.toContain('Wir haben ein paar Ideen für dich!');
  });

  it('falls back to the title and teaser when an item has no image', async () => {
    const { element } = await setup({ item: item({ imagePath: null }) });

    expect(element.querySelector('img')).toBeNull();
    expect(element.textContent).toContain('Wir haben ein paar Ideen für dich!');
  });

  it('shows a "Mehr lesen" hint', async () => {
    const { element } = await setup();

    expect(element.textContent).toContain('Mehr lesen');
  });

  it('marks a video on its picture and invites to watch it', async () => {
    const { element } = await setup({
      item: item({
        imagePath: '/content/images/body.webp',
        video: { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' },
      }),
    });

    expect(element.querySelector('.rk-pill-solid.absolute')?.textContent?.trim()).toBe('Video');
    expect(element.textContent).toContain('Video ansehen');
    expect(element.textContent).not.toContain('Mehr lesen');
  });

  it('leaves out the teaser line of an item without a teaser', async () => {
    const { element } = await setup({ item: item({ imagePath: null, teaser: '' }) });

    expect(element.querySelector('.line-clamp-2')).toBeNull();
  });

  it('is one link covering the whole card, into the item detail route', async () => {
    const { element } = await setup({ item: item({ id: 'wi-07' }) });

    const links = element.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toContain('wi-07');
    expect(links[0].textContent).toContain('Was tut dir gut?');
    expect(links[0].textContent).toContain('Mehr lesen');
  });

  it('greets when the interactor says so, then records the greeting for the day', async () => {
    const { element, daily } = await setup();

    // jsdom never runs CSS animations, so the class is what there is to assert - the keyframes
    // themselves live in styles/components/arrived.css.
    expect(element.querySelector('.rk-arrived')).not.toBeNull();
    expect(daily.greetedDays).toEqual([TODAY]);
  });

  it('stays still once it has already greeted', async () => {
    const { element } = await setup({ alreadyGreeted: true });

    expect(element.querySelector('.rk-arrived')).toBeNull();
  });

  it('greets with the haptic pattern as well as the wave', async () => {
    const { haptics } = await setup();

    expect(haptics.plays).toBe(1);
  });

  it('stays silent once it has already greeted', async () => {
    const { haptics } = await setup({ alreadyGreeted: true });

    expect(haptics.plays).toBe(0);
  });

  it('greets again when the app is reopened while Today is on screen', async () => {
    const { element, daily, haptics, settle } = await setup();
    expect(haptics.plays).toBe(1);

    daily.reopen();
    await settle();
    // The class is still on the card from the first greeting, so it leaves for a frame first.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();

    expect(element.querySelector('.rk-arrived')).not.toBeNull();
    expect(element.querySelector('.rk-arrived-stretched')).toBeNull();
    expect(haptics.plays).toBe(2);
    expect(daily.greetedDays).toEqual([TODAY, TODAY]);
  });

  it('does not answer a shake when the greeting is switched off', async () => {
    const { element, shake, haptics, settle } = await setup({ greetingOff: true });

    shake.shake?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();

    expect(element.querySelector('.rk-arrived')).toBeNull();
    expect(haptics.plays).toBe(0);
  });

  it('stretches the replayed greeting on both channels, but not the arrival one', async () => {
    const { element, settle, shake, haptics } = await setup();

    // The arrival plays at its ordinary length.
    expect(element.querySelector('.rk-arrived-stretched')).toBeNull();
    expect(haptics.lastOptions).toEqual({ replay: false });

    shake.shake?.();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await settle();

    expect(element.querySelector('.rk-arrived-stretched')).not.toBeNull();
    expect(haptics.lastOptions).toEqual({ replay: true });
  });

  it('listens for light shakes, not only for hard ones', async () => {
    const { shake } = await setup();

    expect(shake.options).toEqual({ sensitivity: 'light' });
  });

  it('replays the greeting when the phone is shaken', async () => {
    const { element, settle, shake, haptics } = await setup({ alreadyGreeted: true });
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

  it('stops the sensor that only starts once the card is already gone', async () => {
    const { destroy, shake } = await setup({ slowShakeSensor: true });

    destroy();
    shake.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(shake.stopped).toBe(1);
  });
});
