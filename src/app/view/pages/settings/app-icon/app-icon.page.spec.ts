import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

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
      id: 'klassisch',
      label: 'Klassisch',
      description: null,
      previewUrl: 'app-icons/klassisch.webp',
    },
    { id: 'pixel', label: 'Pixel', description: null, previewUrl: 'app-icons/pixel.webp' },
    { id: 'nacht', label: 'Nacht', description: null, previewUrl: 'app-icons/nacht.webp' },
  ];

  snapshot: AppIconSnapshot = { available: true, selected: 'klassisch' };
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

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AppIconInteractor, useValue: appIcon },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  });

  const fixture = TestBed.createComponent(AppIconPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, appIcon, announcer, fixture };
}

describe('AppIconPage', () => {
  it('renders one radio per icon with the active one checked', async () => {
    const { element } = await setup({ available: true, selected: 'nacht' });

    const radios = [...element.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((radio) => radio.value)).toEqual(['klassisch', 'pixel', 'nacht']);
    expect(radios.filter((radio) => radio.checked).map((radio) => radio.value)).toEqual(['nacht']);
  });

  it('changes the icon when an option is picked', async () => {
    const { element, appIcon, fixture } = await setup();

    const pixel = element.querySelector<HTMLInputElement>('input[value="pixel"]')!;
    pixel.click();
    await fixture.whenStable();

    expect(appIcon.selectCalls).toEqual(['pixel']);
  });

  it('announces the new icon once', async () => {
    const { element, announcer, fixture } = await setup();

    element.querySelector<HTMLInputElement>('input[value="pixel"]')!.click();
    await fixture.whenStable();

    expect(announcer.announcements).toEqual(['App-Symbol: Pixel']);
  });

  it('offers no choice where alternate icons are unavailable', async () => {
    const { element } = await setup({ available: false, selected: 'klassisch' });

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
