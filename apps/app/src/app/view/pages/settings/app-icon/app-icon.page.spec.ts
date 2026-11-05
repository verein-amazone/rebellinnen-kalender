import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import {
  AppIconInteractor,
  type AppIconId,
  type AppIconOption,
  type AppIconSnapshot,
} from '@app/interactors/settings/app-icon.interactor';

import { AppIconPage } from './app-icon.page';

class FakeAppIconInteractor {
  readonly options: readonly AppIconOption[] = [
    {
      id: 'cool-cat-nacht',
      label: 'Leo dunkel',
      description: null,
      previewUrl: 'app-icons/cool-cat-nacht.webp',
    },
    {
      id: 'cool-cat-lila',
      label: 'Leo lila',
      description: null,
      previewUrl: 'app-icons/cool-cat-lila.webp',
    },
    {
      id: 'sam-orange',
      label: 'Sam Orange',
      description: null,
      previewUrl: 'app-icons/sam-orange.webp',
    },
  ];

  snapshot: AppIconSnapshot = { available: true, selected: 'cool-cat-nacht' };
  readonly selectCalls: AppIconId[] = [];

  loadSnapshot(): Promise<AppIconSnapshot> {
    return Promise.resolve(this.snapshot);
  }

  select(id: AppIconId): Promise<void> {
    this.selectCalls.push(id);
    this.snapshot = { ...this.snapshot, selected: id };
    return Promise.resolve();
  }

  labelOf(id: AppIconId): string {
    return this.options.find((option) => option.id === id)?.label ?? id;
  }
}

class FakeHapticsInteractor {
  selections = 0;

  selection(): Promise<void> {
    this.selections += 1;
    return Promise.resolve();
  }
}

class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

async function setup(snapshot?: AppIconSnapshot) {
  const appIcon = new FakeAppIconInteractor();
  if (snapshot !== undefined) {
    appIcon.snapshot = snapshot;
  }
  const announcer = new StubLiveAnnouncer();
  const haptics = new FakeHapticsInteractor();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppIconInteractor, useValue: appIcon },
      { provide: LiveAnnouncer, useValue: announcer },
      { provide: HapticsInteractor, useValue: haptics },
    ],
  });

  const fixture = TestBed.createComponent(AppIconPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, appIcon, announcer, haptics, fixture };
}

describe('AppIconPage', () => {
  it('renders one radio per icon with the active one checked', async () => {
    const { element } = await setup({ available: true, selected: 'sam-orange' });

    const radios = [...element.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((radio) => radio.value)).toEqual([
      'cool-cat-nacht',
      'cool-cat-lila',
      'sam-orange',
    ]);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual([
      'sam-orange',
    ]);
  });

  it('changes the icon when an option is picked', async () => {
    const { element, appIcon, fixture } = await setup();

    const lila = element.querySelector<HTMLInputElement>('input[value="cool-cat-lila"]')!;
    lila.click();
    await fixture.whenStable();

    expect(appIcon.selectCalls).toEqual(['cool-cat-lila']);
  });

  it('announces the new icon once', async () => {
    const { element, announcer, fixture } = await setup();

    element.querySelector<HTMLInputElement>('input[value="cool-cat-lila"]')!.click();
    await fixture.whenStable();

    expect(announcer.announcements).toEqual(['App-Symbol: Leo lila']);
  });

  it('confirms the switch with one selection tick', async () => {
    const { element, haptics, fixture } = await setup();

    element.querySelector<HTMLInputElement>('input[value="cool-cat-lila"]')!.click();
    await fixture.whenStable();

    expect(haptics.selections).toBe(1);
  });

  it('offers no choice where alternate icons are unavailable', async () => {
    const { element } = await setup({ available: false, selected: 'cool-cat-nacht' });

    expect(element.querySelectorAll('input[type="radio"]')).toHaveLength(0);
    expect(element.textContent).toContain('nicht');
  });

  it('labels every preview image as decorative', async () => {
    const { element } = await setup();

    const previews = [...element.querySelectorAll('img')];
    expect(previews).toHaveLength(3);
    expect(previews.every((preview) => preview.getAttribute('alt') === '')).toBe(true);
  });
});
