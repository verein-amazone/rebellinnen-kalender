import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { HardwareBack } from '@app/cross-cutting/infrastructure/hardware-back';

import { InfoToggletip } from './info-toggletip';

@Component({
  imports: [InfoToggletip],
  template: `
    <app-info-toggletip label="Info zu Meine Sammlung"
      >Hier landen deine Lesezeichen.</app-info-toggletip
    >
    <button type="button" id="elsewhere">Woanders</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('InfoToggletip', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  const trigger = () => element.querySelector<HTMLButtonElement>('app-info-toggletip button')!;
  const panel = () => element.querySelector<HTMLElement>('.rk-toggletip');

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element);
    await fixture.whenStable();
  });

  afterEach(() => element.remove());

  async function open(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  it('is a closed disclosure button named by its label', () => {
    expect(trigger().getAttribute('aria-label')).toBe('Info zu Meine Sammlung');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
    expect(panel()).toBeNull();
  });

  it('shows the explanation right after the button and points the button at it', async () => {
    await open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(panel()?.textContent?.trim()).toBe('Hier landen deine Lesezeichen.');
    expect(trigger().getAttribute('aria-controls')).toBe(panel()?.id);
    expect(trigger().nextElementSibling).toBe(panel());
  });

  it('closes when the button is tapped again', async () => {
    await open();
    await open();

    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on a tap anywhere else, but not on a tap inside the explanation', async () => {
    await open();

    panel()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(panel()).not.toBeNull();

    element
      .querySelector('#elsewhere')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(panel()).toBeNull();
  });

  it('closes on Escape from inside and hands focus back to the button', async () => {
    await open();
    panel()!.focus();

    panel()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on Android's back button while open, and leaves it to the screen otherwise", async () => {
    const back = TestBed.inject(HardwareBack);
    const screen = vi.fn(() => true);
    back.register(screen);
    await open();

    back.press();
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(screen).not.toHaveBeenCalled();

    back.press();
    expect(screen).toHaveBeenCalledOnce();
  });
});
