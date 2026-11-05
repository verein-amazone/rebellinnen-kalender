import { TestBed } from '@angular/core/testing';

import { SIRI_AND_SEARCH_PLUGIN } from '@app/cross-cutting/plugins/siri-and-search.plugin';

import { DevicePlatformService } from './device-platform';
import { DeviceSiriAndSearch } from './siri-and-search';

class FakePlugin {
  calls: string[] = [];
  failing = false;
  listener: ((event: { destination: string }) => void) | null = null;
  removed = 0;

  replaceDomain(options: { domain: string; items: readonly unknown[] }): Promise<void> {
    this.calls.push(`replace ${options.domain} ${options.items.length}`);
    return this.failing ? Promise.reject(new Error('index unavailable')) : Promise.resolve();
  }

  donate(options: { destination: string }): Promise<void> {
    this.calls.push(`donate ${options.destination}`);
    return this.failing ? Promise.reject(new Error('unknown destination')) : Promise.resolve();
  }

  deleteAll(): Promise<void> {
    this.calls.push('delete all');
    return this.failing ? Promise.reject(new Error('index unavailable')) : Promise.resolve();
  }

  addListener(
    _eventName: 'destinationOpened',
    listener: (event: { destination: string }) => void,
  ): Promise<{ remove: () => Promise<void> }> {
    this.listener = listener;
    return Promise.resolve({
      remove: () => {
        this.removed += 1;
        this.listener = null;
        return Promise.resolve();
      },
    });
  }
}

function setup(platform: 'ios' | 'android' | 'web' = 'ios') {
  const plugin = new FakePlugin();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SIRI_AND_SEARCH_PLUGIN, useValue: plugin },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });
  return { device: TestBed.inject(DeviceSiriAndSearch), plugin };
}

const ENTRY = { id: 'service:a', title: 'A', description: 'B', keywords: [] };

describe('DeviceSiriAndSearch', () => {
  it.each(['android', 'web'] as const)('does nothing on %s', async (platform) => {
    const { device, plugin } = setup(platform);
    const handler = vi.fn();

    expect(device.isSupported()).toBe(false);
    await device.replaceDomain('support-services', [ENTRY]);
    await device.donate('today');
    await device.deleteAll();
    device.onDestinationOpened(handler)();

    expect(plugin.calls).toEqual([]);
    expect(plugin.listener).toBeNull();
  });

  it('writes one domain at a time on iOS', async () => {
    const { device, plugin } = setup();

    await device.replaceDomain('support-services', [ENTRY]);

    expect(plugin.calls).toEqual(['replace support-services 1']);
  });

  it('passes a failed write on, so it can be repeated', async () => {
    const { device, plugin } = setup();
    plugin.failing = true;

    await expect(device.replaceDomain('support-services', [ENTRY])).rejects.toThrow(
      'index unavailable',
    );
  });

  it('swallows a failed donation and a failed clear', async () => {
    const { device, plugin } = setup();
    plugin.failing = true;

    await expect(device.donate('today')).resolves.toBeUndefined();
    await expect(device.deleteAll()).resolves.toBeUndefined();
    expect(plugin.calls).toEqual(['donate today', 'delete all']);
  });

  it('hands on opened destinations until it is stopped', async () => {
    const { device, plugin } = setup();
    const handler = vi.fn();

    const stop = device.onDestinationOpened(handler);
    await Promise.resolve();
    plugin.listener?.({ destination: 'today' });
    stop();
    await Promise.resolve();

    expect(handler).toHaveBeenCalledExactlyOnceWith('today');
    expect(plugin.removed).toBe(1);
  });

  it('removes a listener stopped before it was registered', async () => {
    const { device, plugin } = setup();

    device.onDestinationOpened(vi.fn())();
    await Promise.resolve();
    await Promise.resolve();

    expect(plugin.removed).toBe(1);
  });
});
