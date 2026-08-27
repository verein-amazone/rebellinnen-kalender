import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { AppIconGateway } from '@app/data/gateways/app-icon.gateway';

import { AppIconInteractor } from './app-icon.interactor';

class FakeAppIconGateway {
  available = true;
  currentIcon: string | null = null;
  readonly setIconCalls: string[] = [];
  resetIconCalls = 0;

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  getCurrentIcon(): Promise<string | null> {
    return Promise.resolve(this.currentIcon);
  }

  setIcon(name: string): Promise<void> {
    this.setIconCalls.push(name);
    return Promise.resolve();
  }

  resetIcon(): Promise<void> {
    this.resetIconCalls += 1;
    return Promise.resolve();
  }
}

function setup(platform: 'ios' | 'android' | 'web' = 'ios') {
  const gateway = new FakeAppIconGateway();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AppIconGateway, useValue: gateway },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });

  return { interactor: TestBed.inject(AppIconInteractor), gateway };
}

describe('AppIconInteractor', () => {
  it('offers every icon with a label and a preview', () => {
    const { interactor } = setup();

    expect(interactor.options.map((option) => option.id)).toEqual(['klassisch', 'pixel', 'nacht']);
    for (const option of interactor.options) {
      expect(option.label).not.toBe('');
      expect(option.previewUrl).toContain(option.id);
    }
  });

  it('reads the default icon as the first option', async () => {
    const { interactor, gateway } = setup();
    gateway.currentIcon = null;

    await expect(interactor.loadSnapshot()).resolves.toEqual({
      available: true,
      selected: 'klassisch',
    });
  });

  it('maps the active native icon name back to its id', async () => {
    const { interactor, gateway } = setup();
    gateway.currentIcon = 'Nacht';

    await expect(interactor.loadSnapshot()).resolves.toEqual({
      available: true,
      selected: 'nacht',
    });
  });

  it('falls back to the default id when the native name is unknown', async () => {
    const { interactor, gateway } = setup();
    gateway.currentIcon = 'Weihnachten';

    await expect(interactor.loadSnapshot()).resolves.toEqual({
      available: true,
      selected: 'klassisch',
    });
  });

  it('reports unavailable on devices without alternate-icon support', async () => {
    const { interactor, gateway } = setup();
    gateway.available = false;

    await expect(interactor.loadSnapshot()).resolves.toEqual({
      available: false,
      selected: 'klassisch',
    });
  });

  it('reports unavailable on the web without touching the plugin', async () => {
    const { interactor, gateway } = setup('web');
    gateway.currentIcon = 'Pixel';

    await expect(interactor.loadSnapshot()).resolves.toEqual({
      available: false,
      selected: 'klassisch',
    });
  });

  it('sets an alternate icon by its native name', async () => {
    const { interactor, gateway } = setup();

    await interactor.select('pixel');

    expect(gateway.setIconCalls).toEqual(['Pixel']);
    expect(gateway.resetIconCalls).toBe(0);
  });

  it('restores the default icon rather than setting one by name', async () => {
    const { interactor, gateway } = setup();

    await interactor.select('klassisch');

    expect(gateway.resetIconCalls).toBe(1);
    expect(gateway.setIconCalls).toEqual([]);
  });
});
