import { TestBed } from '@angular/core/testing';

import { DeviceHaptics, type HapticPulse } from '@app/cross-cutting/infrastructure/haptics';
import { AppearanceStore } from '@app/data/stores/appearance.store';

import { HapticsInteractor } from './haptics.interactor';

class FakeDeviceHaptics {
  available = true;
  patterns: (readonly HapticPulse[])[] = [];

  isAvailable(): Promise<boolean> {
    return Promise.resolve(this.available);
  }

  playPattern(pulses: readonly HapticPulse[]): Promise<void> {
    this.patterns.push(pulses);
    return Promise.resolve();
  }

  moments: string[] = [];

  success(): Promise<void> {
    this.moments.push('success');
    return Promise.resolve();
  }

  lightImpact(): Promise<void> {
    this.moments.push('lightImpact');
    return Promise.resolve();
  }

  selectionChanged(): Promise<void> {
    this.moments.push('selectionChanged');
    return Promise.resolve();
  }
}

function setup(): { interactor: HapticsInteractor; gateway: FakeDeviceHaptics } {
  const gateway = new FakeDeviceHaptics();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: DeviceHaptics, useValue: gateway }],
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

  it('spreads a replayed greeting over half again as long, at unchanged strength', async () => {
    const { interactor, gateway } = setup();

    await interactor.playArrival();
    const arrival = gateway.patterns[0];

    await interactor.playArrival({ replay: true });
    const replay = gateway.patterns[1];

    expect(replay).toHaveLength(arrival.length);
    replay.forEach((pulse, index) => {
      expect(pulse.time).toBeCloseTo(arrival[index].time * 1.5);
      expect(pulse.intensity).toBe(arrival[index].intensity);
    });
  });

  it('maps each small moment onto its platform feedback', async () => {
    const { interactor, gateway } = setup();

    await interactor.confirm();
    await interactor.tick();
    await interactor.selection();

    expect(gateway.moments).toEqual(['success', 'lightImpact', 'selectionChanged']);
  });

  it('stays silent everywhere when vibration is switched off', async () => {
    const { interactor, gateway } = setup();
    TestBed.inject(AppearanceStore).update({ vibration: 'off' });

    await interactor.playArrival();
    await interactor.confirm();
    await interactor.tick();
    await interactor.selection();

    expect(gateway.patterns).toHaveLength(0);
    expect(gateway.moments).toHaveLength(0);
  });

  it('stays silent on a device without haptics', async () => {
    const { interactor, gateway } = setup();
    gateway.available = false;

    await interactor.playArrival();
    await interactor.confirm();

    expect(gateway.patterns).toHaveLength(0);
    expect(gateway.moments).toHaveLength(0);
  });
});
