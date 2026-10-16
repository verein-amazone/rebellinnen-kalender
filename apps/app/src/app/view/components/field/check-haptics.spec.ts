import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';

import { CheckHaptics } from './check-haptics';

class FakeHapticsInteractor {
  ticks = 0;

  tick(): Promise<void> {
    this.ticks += 1;
    return Promise.resolve();
  }
}

@Component({
  imports: [CheckHaptics],
  template: `
    <input id="switch" type="checkbox" role="switch" class="rk-toggle" appCheckHaptics />
    <input id="check" type="checkbox" class="rk-check" appCheckHaptics />
    <input id="plain" type="checkbox" class="rk-check" />
  `,
})
class HostComponent {}

describe('CheckHaptics', () => {
  async function setup() {
    const haptics = new FakeHapticsInteractor();
    TestBed.configureTestingModule({
      providers: [{ provide: HapticsInteractor, useValue: haptics }],
    });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string) => element.querySelector<HTMLInputElement>(`#${id}`)!;
    return { haptics, input };
  }

  it('ticks when a switch is turned on and again when it is turned off', async () => {
    const { haptics, input } = await setup();

    input('switch').click();
    input('switch').click();

    expect(haptics.ticks).toBe(2);
  });

  it('ticks when a checkbox is ticked', async () => {
    const { haptics, input } = await setup();

    input('check').click();

    expect(haptics.ticks).toBe(1);
  });

  it('leaves a checkbox without the directive alone', async () => {
    const { haptics, input } = await setup();

    input('plain').click();

    expect(haptics.ticks).toBe(0);
  });
});
