import { TestBed } from '@angular/core/testing';

import { SHAKE_PLUGIN } from './shake-plugin';
import { ShakeGateway } from './shake.gateway';

class StubShakePlugin {
  listeners: (() => void)[] = [];
  watching = false;
  removed = 0;
  failing = false;

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
    this.watching = true;
    return Promise.resolve();
  }

  stopWatching(): Promise<void> {
    this.watching = false;
    return Promise.resolve();
  }
}

function setup(): { gateway: ShakeGateway; plugin: StubShakePlugin } {
  const plugin = new StubShakePlugin();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: SHAKE_PLUGIN, useValue: plugin }] });

  return { gateway: TestBed.inject(ShakeGateway), plugin };
}

describe('ShakeGateway', () => {
  // Under jsdom the platform is `web`, where the plugin has no implementation - the gateway is
  // expected to hand back a working no-op rather than let a caller branch on the platform.
  it('is a no-op on the web, without touching the plugin', async () => {
    const { gateway, plugin } = setup();
    let shaken = 0;

    const stop = await gateway.watch(() => (shaken += 1));
    stop();

    expect(plugin.watching).toBe(false);
    expect(plugin.listeners).toHaveLength(0);
    expect(shaken).toBe(0);
  });
});
