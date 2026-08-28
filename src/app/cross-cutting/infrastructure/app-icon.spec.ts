import { TestBed } from '@angular/core/testing';
import type { AppIcon } from '@capawesome/capacitor-app-icon';
import { describe, expect, it } from 'vitest';

import { APP_ICON_PLUGIN } from '@app/cross-cutting/plugins/app-icon.plugin';
import { DeviceAppIcon } from './app-icon';

function setup(plugin: Partial<typeof AppIcon>): DeviceAppIcon {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: APP_ICON_PLUGIN, useValue: plugin }],
  });

  return TestBed.inject(DeviceAppIcon);
}

describe('DeviceAppIcon', () => {
  it('reports whether the device supports alternate icons', async () => {
    const gateway = setup({ isAvailable: async () => ({ available: false }) });

    await expect(gateway.isAvailable()).resolves.toBe(false);
  });

  it('resolves the name of the active alternate icon', async () => {
    const gateway = setup({ getCurrentIcon: async () => ({ icon: 'Pixel' }) });

    await expect(gateway.getCurrentIcon()).resolves.toBe('Pixel');
  });

  it('resolves null while the default icon is active', async () => {
    const gateway = setup({ getCurrentIcon: async () => ({ icon: null }) });

    await expect(gateway.getCurrentIcon()).resolves.toBeNull();
  });

  it('passes the icon name through to the plugin', async () => {
    const names: string[] = [];
    const gateway = setup({
      setIcon: async ({ icon }) => {
        names.push(icon);
      },
    });

    await gateway.setIcon('Nacht');

    expect(names).toEqual(['Nacht']);
  });

  it('restores the default icon', async () => {
    let resetCalls = 0;
    const gateway = setup({
      resetIcon: async () => {
        resetCalls += 1;
      },
    });

    await gateway.resetIcon();

    expect(resetCalls).toBe(1);
  });
});
