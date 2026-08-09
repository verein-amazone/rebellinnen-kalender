import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';

import { TextField } from './text-field';

@Component({
  imports: [TextField],
  template: `
    <app-text-field
      id="appointment-title"
      label="Titel"
      placeholder="Zahnarzt"
      [field]="form.title"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly model = signal({ title: '' });
  readonly form = form(this.model, (schemaPath) => {
    required(schemaPath.title, { message: 'Bitte gib einen Titel ein.' });
  });
}

@Component({
  imports: [TextField],
  template: `
    <app-text-field
      id="with-hint"
      label="Titel"
      hint="Wird nur dir angezeigt."
      [field]="form.title"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostWithHintComponent {
  readonly model = signal({ title: '' });
  readonly form = form(this.model);
}

@Component({
  imports: [TextField],
  template: `
    <app-text-field id="appointment-date" label="Datum" type="date" [field]="form.date" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DateHostComponent {
  readonly model = signal({ date: '' });
  readonly form = form(this.model);
}

@Component({
  imports: [TextField],
  template: `
    <app-text-field id="appointment-time" label="Uhrzeit" type="time" [field]="form.time" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TimeHostComponent {
  readonly model = signal({ time: '' });
  readonly form = form(this.model);
}

describe('TextField', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input')!;
    const liveRegion = element.querySelector('[aria-live="polite"]')!;
    return { fixture, element, input, liveRegion };
  }

  it('renders a real label associated with the input via for/id', async () => {
    const { element, input } = await setup();
    const label = element.querySelector('label')!;

    expect(label.getAttribute('for')).toBe('appointment-title');
    expect(input.id).toBe('appointment-title');
    expect(label.textContent?.trim()).toBe('Titel');
  });

  it('does not also reflect the static id onto the host element', async () => {
    const { fixture } = await setup();
    const matches = (fixture.nativeElement as HTMLElement).querySelectorAll('#appointment-title');

    // A plain @Input `id` reflects onto the host element by default when a consumer writes a
    // static `id="…"` attribute — duplicating the id the inner <input> needs for `<label for>`.
    // Exactly one element must carry it, or `#id` lookups (and the label association) break.
    expect(matches).toHaveLength(1);
    expect(matches[0].tagName).toBe('INPUT');
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-text-field')!;
    expect(host.hasAttribute('id')).toBe(false);
  });

  it('carries a placeholder attribute, never as the only label', async () => {
    const { input } = await setup();

    expect(input.getAttribute('placeholder')).toBe('Zahnarzt');
  });

  it('keeps the error live region in the DOM even while the field is pristine and invalid', async () => {
    const { input, liveRegion } = await setup();

    expect(liveRegion.getAttribute('aria-atomic')).toBe('true');
    expect(liveRegion.querySelector('.rk-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('shows the error text and binds aria-invalid/aria-describedby only once touched', async () => {
    const { fixture, input, liveRegion } = await setup();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error = liveRegion.querySelector('.rk-error');
    expect(error?.textContent).toBe('Bitte gib einen Titel ein.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('clears the error once the field becomes valid', async () => {
    const { fixture, input, liveRegion } = await setup();

    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(liveRegion.querySelector('.rk-error')).not.toBeNull();

    input.value = 'Zahnarzt';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(liveRegion.querySelector('.rk-error')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('writes user input back into the form model', async () => {
    const { fixture, input } = await setup();

    input.value = 'Zahnarzt';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().title).toBe('Zahnarzt');
  });

  it('renders no hint by default, and the given hint text when provided', async () => {
    const { element } = await setup();
    expect(element.querySelector('.rk-hint')).toBeNull();

    const withHint = TestBed.createComponent(HostWithHintComponent);
    await withHint.whenStable();
    const hint = (withHint.nativeElement as HTMLElement).querySelector('.rk-hint');

    expect(hint?.textContent?.trim()).toBe('Wird nur dir angezeigt.');
  });
});

describe('TextField, type="date"', () => {
  async function setup() {
    const fixture = TestBed.createComponent(DateHostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input')!;
    return { fixture, input };
  }

  it('renders the native input as type="date"', async () => {
    const { input } = await setup();

    expect(input.type).toBe('date');
  });

  it('round-trips an ISO date string from the model onto the native control', async () => {
    const fixture = TestBed.createComponent(DateHostComponent);
    fixture.componentInstance.model.set({ date: '2026-08-07' });
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;

    expect(input.value).toBe('2026-08-07');
  });

  it('round-trips a user-entered date back into the model as an ISO string', async () => {
    const { fixture, input } = await setup();

    input.value = '2026-12-24';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().date).toBe('2026-12-24');
  });
});

describe('TextField, type="time"', () => {
  async function setup() {
    const fixture = TestBed.createComponent(TimeHostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input')!;
    return { fixture, input };
  }

  it('renders the native input as type="time"', async () => {
    const { input } = await setup();

    expect(input.type).toBe('time');
  });

  it('round-trips an HH:mm string from the model onto the native control', async () => {
    const fixture = TestBed.createComponent(TimeHostComponent);
    fixture.componentInstance.model.set({ time: '14:30' });
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;

    expect(input.value).toBe('14:30');
  });

  it('round-trips a user-entered time back into the model as an HH:mm string', async () => {
    const { fixture, input } = await setup();

    input.value = '09:15';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().time).toBe('09:15');
  });
});
