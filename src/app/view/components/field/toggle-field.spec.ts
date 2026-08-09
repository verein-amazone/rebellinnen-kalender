import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, validate } from '@angular/forms/signals';

import { ToggleField } from './toggle-field';

@Component({
  imports: [ToggleField, FormField],
  template: `
    <app-toggle-field id="appointment-all-day" label="Ganztägig" [formField]="form.allDay" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly model = signal({ allDay: false });
  readonly form = form(this.model, (schemaPath) => {
    // A rule that always fails, purely so the touched/invalid test below has an error to reveal.
    validate(schemaPath.allDay, () => ({ kind: 'always', message: 'Bitte wähle eine Option.' }));
  });
}

describe('ToggleField', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const liveRegion = element.querySelector('[aria-live="polite"]')!;
    return { fixture, element, input, liveRegion };
  }

  it('renders a native checkbox with role="switch"', async () => {
    const { input } = await setup();

    expect(input.type).toBe('checkbox');
    expect(input.getAttribute('role')).toBe('switch');
  });

  it('shows the label text', async () => {
    const { element } = await setup();
    expect(element.querySelector('.rk-choice-text')?.textContent?.trim()).toBe('Ganztägig');
  });

  it('reflects the current boolean value onto the checkbox', async () => {
    const { input } = await setup();
    expect(input.checked).toBe(false);
  });

  it('does not reflect the static id onto the host element', async () => {
    const { fixture } = await setup();
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-toggle-field')!;
    expect(host.hasAttribute('id')).toBe(false);
  });

  it('writes the new value back into the form model when toggled', async () => {
    const { fixture, input } = await setup();

    input.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().allDay).toBe(true);
  });

  it('keeps the error live region in the DOM before the field is touched', async () => {
    const { liveRegion } = await setup();

    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
    expect(liveRegion.querySelector('.rk-error')).toBeNull();
  });

  it('shows the error and binds aria-invalid/aria-describedby only once touched', async () => {
    const { fixture, input, liveRegion } = await setup();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error = liveRegion.querySelector('.rk-error');
    expect(error?.textContent).toBe('Bitte wähle eine Option.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error?.id);
  });
});
