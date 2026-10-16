import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';

import { RadioGroupField } from './radio-group-field';

@Component({
  imports: [RadioGroupField],
  template: `
    <app-radio-group-field
      id="appointment-calendar"
      legend="Kalender"
      [field]="form.calendarId"
      [options]="options"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly options = [
    { value: 'privat', label: 'Privat' },
    { value: 'verein', label: 'Verein', description: 'Sichtbar für alle Mitglieder' },
  ];

  readonly model = signal({ calendarId: '' });
  readonly form = form(this.model, (schemaPath) => {
    required(schemaPath.calendarId, { message: 'Bitte wähle einen Kalender.' });
  });
}

@Component({
  imports: [RadioGroupField],
  template: `
    <app-radio-group-field
      id="appointment-calendar-2"
      legend="Kalender"
      [legendHidden]="true"
      [field]="form.calendarId"
      [options]="options"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HiddenLegendHostComponent {
  readonly options = [{ value: 'privat', label: 'Privat' }];
  readonly model = signal({ calendarId: '' });
  readonly form = form(this.model);
}

describe('RadioGroupField', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const inputs = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const liveRegion = element.querySelector('[aria-live="polite"]')!;
    return { fixture, element, inputs, liveRegion };
  }

  it('renders one native radio per option inside a fieldset/legend, sharing one group name', async () => {
    const { element, inputs } = await setup();
    const fieldset = element.querySelector('fieldset')!;
    const legend = fieldset.querySelector('legend')!;

    expect(legend.textContent?.trim()).toBe('Kalender');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].name).not.toBe('');
    expect(inputs[0].name).toBe(inputs[1].name);
  });

  it('does not reflect the static id onto the host element', async () => {
    const { fixture } = await setup();

    // `id` is a plain @Input, so a static `id="…"` in the consumer's template would otherwise
    // reflect onto this host element by default. Nothing inside currently uses the raw `id` as an
    // element id (only `${id}-error` does, on the error paragraph), but the host must not carry it
    // either - a consumer or a future template change could collide with it.
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-radio-group-field')!;
    expect(host.hasAttribute('id')).toBe(false);
  });

  it('folds the description into the option label, so it becomes part of the accessible name', async () => {
    const { element } = await setup();
    const labels = Array.from(element.querySelectorAll('label'));

    expect(labels[0].textContent?.trim()).toBe('Privat');
    expect(labels[1].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Verein Sichtbar für alle Mitglieder',
    );
  });

  it('selecting an option writes its value back into the form model', async () => {
    const { fixture, inputs } = await setup();

    inputs[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().calendarId).toBe('verein');
    expect(inputs[0].checked).toBe(false);
    expect(inputs[1].checked).toBe(true);
  });

  it('keeps the error live region in the DOM before any option is touched', async () => {
    const { liveRegion } = await setup();

    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
    expect(liveRegion.querySelector('.rk-error')).toBeNull();
  });

  it('shows the error and binds aria-invalid/aria-describedby only once touched', async () => {
    const { fixture, inputs, liveRegion } = await setup();

    // The model starts as '', which `required` already rejects - blurring without picking an
    // option is what reveals that, matching how a user would tab past the group untouched.
    inputs[0].dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error = liveRegion.querySelector('.rk-error');
    expect(error?.textContent).toBe('Bitte wähle einen Kalender.');
    expect(inputs[0].getAttribute('aria-invalid')).toBe('true');
    expect(inputs[0].getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('keeps the legend visible by default, and hides it visually (not from the a11y tree) when asked', async () => {
    const { element } = await setup();
    const visibleLegend = element.querySelector('legend')!;
    expect(visibleLegend.classList.contains('sr-only')).toBe(false);

    const hidden = TestBed.createComponent(HiddenLegendHostComponent);
    await hidden.whenStable();
    const hiddenLegend = (hidden.nativeElement as HTMLElement).querySelector('legend')!;

    expect(hiddenLegend.classList.contains('sr-only')).toBe(true);
    expect(hiddenLegend.textContent?.trim()).toBe('Kalender');
  });
});
