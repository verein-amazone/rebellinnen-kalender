import { TestBed } from '@angular/core/testing';

import { HAPTICS_PLUGIN } from '@app/cross-cutting/plugins/haptics.plugin';
import { DeviceHaptics } from './haptics';

class StubHapticsPlugin {
  available = true;
  failing = false;
  patterns: unknown[] = [];

  isAvailable(): Promise<{ available: boolean }> {
    if (this.failing) {
      return Promise.reject(new Error('no engine'));
    }
    return Promise.resolve({ available: this.available });
  }

  playPattern(options: unknown): Promise<void> {
    if (this.failing) {
      return Promise.reject(new Error('no engine'));
    }
    this.patterns.push(options);
    return Promise.resolve();
  }
}

function setup(): { gateway: DeviceHaptics; plugin: StubHapticsPlugin } {
  const plugin = new StubHapticsPlugin();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: HAPTICS_PLUGIN, useValue: plugin }] });

  return { gateway: TestBed.inject(DeviceHaptics), plugin };
}

describe('DeviceHaptics', () => {
  it('passes the pattern to the plugin as plain events', async () => {
    const { gateway, plugin } = setup();

    await gateway.playPattern([{ time: 0, intensity: 0.5, sharpness: 0.4 }]);

    expect(plugin.patterns[0]).toEqual({ events: [{ time: 0, intensity: 0.5, sharpness: 0.4 }] });
  });

  it('reports what the device says about availability', async () => {
    const { gateway, plugin } = setup();
    plugin.available = false;

    await expect(gateway.isAvailable()).resolves.toBe(false);
  });

  // Haptics are decoration: a device that refuses must never surface an error in a screen that
  // only wanted to say hello.
  it('swallows a failing device instead of rejecting', async () => {
    const { gateway, plugin } = setup();
    plugin.failing = true;

    await expect(gateway.isAvailable()).resolves.toBe(false);
    await expect(gateway.playPattern([{ time: 0, intensity: 1 }])).resolves.toBeUndefined();
  });
});
