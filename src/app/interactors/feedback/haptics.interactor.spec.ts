import { TestBed } from '@angular/core/testing';

import { HapticsGateway, type HapticPulse } from '@app/data/gateways/haptics.gateway';
import { AppearanceStore } from '@app/data/stores/appearance.store';

import { HapticsInteractor } from './haptics.interactor';

class FakeHapticsGateway {
  available = true;
  patterns: (readonly HapticPulse[])[] = [];

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  playPattern(pulses: readonly HapticPulse[]): Promise<void> {
    this.patterns.push(pulses);
    return Promise.resolve();
  }
}

function setup(): { interactor: HapticsInteractor; gateway: FakeHapticsGateway } {
  const gateway = new FakeHapticsGateway();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: HapticsGateway, useValue: gateway }],
  });

  return { interactor: TestBed.inject(HapticsInteractor), gateway };
}

describe('HapticsInteractor', () => {
  beforeEach(() => localStorage.clear());

  it('plays a pattern that fades out, matching the card’s wave', async () => {
    const { interactor, gateway } = setup();

    await interactor.playArrival();

    const pattern = gateway.patterns[0];
    expect(pattern.length).toBeGreaterThan(1);
    expect(pattern[0].time).toBe(0);
    // Every beat is softer and later than the one before it - that is what makes it a greeting
    // rather than a knock.
    for (let i = 1; i < pattern.length; i += 1) {
      expect(pattern[i].time).toBeGreaterThan(pattern[i - 1].time);
      expect(pattern[i].intensity).toBeLessThan(pattern[i - 1].intensity);
    }
    // The whole envelope stays inside the 1.2s animation.
    expect(pattern[pattern.length - 1].time).toBeLessThan(1.2);
  });

  it('stays silent when the user switched haptics off', async () => {
    const { interactor, gateway } = setup();
    TestBed.inject(AppearanceStore).update({ haptics: 'off' });

    await interactor.playArrival();

    expect(gateway.patterns).toHaveLength(0);
  });

  it('stays silent on a device without haptics', async () => {
    const { interactor, gateway } = setup();
    gateway.available = false;

    await interactor.playArrival();

    expect(gateway.patterns).toHaveLength(0);
  });
});
