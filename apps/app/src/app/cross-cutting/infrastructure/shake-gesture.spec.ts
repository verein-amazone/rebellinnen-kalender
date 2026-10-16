import { TestBed } from '@angular/core/testing';

import { SHAKE_PLUGIN } from '@app/cross-cutting/plugins/shake.plugin';

import { DevicePlatformService } from './device-platform';
import { ShakeGesture } from './shake-gesture';

class StubShakePlugin {
  listeners: (() => void)[] = [];
  watching = false;
  removed = 0;
  failing = false;
  failingStart = false;

  addListener(_event: 'shake', listener: () => void): Promise<{ remove: () => Promise<void> }> {
    if (this.failing) {
      return Promise.reject(new Error('no sensor'));
    }
    this.listeners.push(listener);
    return Promise.resolve({
      remove: () => {
        this.removed += 1;
        return Promise.resolve();
      },
    });
  }

  startWatching(): Promise<void> {
    if (this.failingStart) {
      return Promise.reject(new Error('sensor busy'));
    }
    this.watching = true;
    return Promise.resolve();
  }

  stopWatching(): Promise<void> {
    this.watching = false;
    return Promise.resolve();
  }
}

function setup(platform: 'ios' | 'android' | 'web' = 'web'): {
  gateway: ShakeGesture;
  plugin: StubShakePlugin;
} {
  const plugin = new StubShakePlugin();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHAKE_PLUGIN, useValue: plugin },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });

  return { gateway: TestBed.inject(ShakeGesture), plugin };
}

describe('ShakeGesture', () => {
  // On the web the plugin has no implementation - the gateway is expected to hand back a working
  // no-op rather than let a caller branch on the platform.
  it('is a no-op on the web, without touching the plugin', async () => {
    const { gateway, plugin } = setup();
    let shaken = 0;

    const stop = await gateway.watch(() => (shaken += 1));
    stop();

    expect(plugin.watching).toBe(false);
    expect(plugin.listeners).toHaveLength(0);
    expect(shaken).toBe(0);
  });

  it('listens on a device until the returned function stops it', async () => {
    const { gateway, plugin } = setup('ios');
    let shaken = 0;

    const stop = await gateway.watch(() => (shaken += 1));
    plugin.listeners[0]();
    stop();

    expect(shaken).toBe(1);
    expect(plugin.watching).toBe(false);
    expect(plugin.removed).toBe(1);
  });

  it('removes its listener again when the sensor refuses to start', async () => {
    const { gateway, plugin } = setup('android');
    plugin.failingStart = true;

    const stop = await gateway.watch(() => undefined);
    stop();

    expect(plugin.removed).toBe(1);
    expect(plugin.watching).toBe(false);
  });

  it('hands back a no-op when the listener cannot be added', async () => {
    const { gateway, plugin } = setup('ios');
    plugin.failing = true;

    const stop = await gateway.watch(() => undefined);

    expect(() => stop()).not.toThrow();
    expect(plugin.watching).toBe(false);
  });
});
