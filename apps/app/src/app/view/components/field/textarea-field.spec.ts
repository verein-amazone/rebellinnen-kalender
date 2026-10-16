import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, maxLength } from '@angular/forms/signals';

import { TextareaField } from './textarea-field';

@Component({
  imports: [TextareaField],
  template: `
    <app-textarea-field id="appointment-note" label="Notiz" [field]="form.note" [rows]="4" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly model = signal({ note: '' });
  readonly form = form(this.model, (schemaPath) => {
    maxLength(schemaPath.note, 5, { message: 'Höchstens 5 Zeichen.' });
  });
}

@Component({
  imports: [TextareaField],
  template: `
    <app-textarea-field id="with-hint" label="Notiz" hint="Sichtbar für alle" [field]="form.note" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostWithHintComponent {
  readonly model = signal({ note: '' });
  readonly form = form(this.model);
}

describe('TextareaField', () => {
  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const textarea = element.querySelector<HTMLTextAreaElement>('textarea')!;
    const liveRegion = element.querySelector('[aria-live="polite"]')!;
    return { fixture, element, textarea, liveRegion };
  }

  it('renders a real label associated with the textarea via for/id', async () => {
    const { element, textarea } = await setup();
    const label = element.querySelector('label')!;

    expect(label.getAttribute('for')).toBe('appointment-note');
    expect(textarea.id).toBe('appointment-note');
    expect(textarea.rows).toBe(4);
  });

  it('does not also reflect the static id onto the host element', async () => {
    const { fixture } = await setup();
    const matches = (fixture.nativeElement as HTMLElement).querySelectorAll('#appointment-note');

    // A plain @Input `id` reflects onto the host element by default when a consumer writes a
    // static `id="…"` attribute - duplicating the id the inner <textarea> needs for `<label for>`.
    // Exactly one element must carry it, or `#id` lookups (and the label association) break.
    expect(matches).toHaveLength(1);
    expect(matches[0].tagName).toBe('TEXTAREA');
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-textarea-field')!;
    expect(host.hasAttribute('id')).toBe(false);
  });

  it('keeps the error live region in the DOM before the field is touched', async () => {
    const { liveRegion } = await setup();

    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
    expect(liveRegion.querySelector('.rk-error')).toBeNull();
  });

  it('shows the error and binds aria-invalid/aria-describedby only once touched', async () => {
    const { fixture, textarea, liveRegion } = await setup();

    textarea.value = 'zu lang für das Feld';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    const error = liveRegion.querySelector('.rk-error');
    expect(error?.textContent).toBe('Höchstens 5 Zeichen.');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea.getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('renders no hint by default, and the given hint text when provided', async () => {
    const { element } = await setup();
    expect(element.querySelector('.rk-hint')).toBeNull();

    const withHint = TestBed.createComponent(HostWithHintComponent);
    await withHint.whenStable();
    const hint = (withHint.nativeElement as HTMLElement).querySelector('.rk-hint');

    expect(hint?.textContent?.trim()).toBe('Sichtbar für alle');
  });
});
