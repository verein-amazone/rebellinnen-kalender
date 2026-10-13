import { TestBed } from '@angular/core/testing';

import { CAPACITOR_APP } from '@app/cross-cutting/plugins/app.plugin';

import { DevicePlatformService } from './device-platform';
import { HardwareBack } from './hardware-back';

class FakeAppPlugin {
  backButton: (() => void) | null = null;
  minimized = 0;

  addBackButtonListener(listener: () => void): Promise<{ remove: () => Promise<void> }> {
    this.backButton = listener;
    return Promise.resolve({ remove: () => Promise.resolve() });
  }

  minimizeApp(): Promise<void> {
    this.minimized += 1;
    return Promise.resolve();
  }
}

function setup(platform: 'android' | 'ios' | 'web' = 'android') {
  const plugin = new FakeAppPlugin();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: CAPACITOR_APP, useValue: plugin },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });
  const back = TestBed.inject(HardwareBack);
  return { back, plugin, pressBack: () => plugin.backButton?.() };
}

describe('HardwareBack', () => {
  it('asks the newest handler first and stops at the one that takes the press', () => {
    const { back, pressBack } = setup();
    const calls: string[] = [];
    back.register(() => {
      calls.push('screen');
      return true;
    });
    back.register(() => {
      calls.push('sheet');
      return true;
    });

    pressBack();

    expect(calls).toEqual(['sheet']);
  });

  it('falls through to an earlier handler when a newer one declines', () => {
    const { back, pressBack } = setup();
    const calls: string[] = [];
    back.register(() => {
      calls.push('screen');
      return true;
    });
    back.register(() => {
      calls.push('declining');
      return false;
    });

    pressBack();

    expect(calls).toEqual(['declining', 'screen']);
  });

  it('sends the app to the background when no handler takes the press', () => {
    const { back, plugin, pressBack } = setup();
    const unregister = back.register(() => true);
    unregister();

    pressBack();

    expect(plugin.minimized).toBe(1);
  });

  it('leaves the back button alone where there is none to take over', () => {
    const { plugin } = setup('ios');

    expect(plugin.backButton).toBeNull();
  });
});
