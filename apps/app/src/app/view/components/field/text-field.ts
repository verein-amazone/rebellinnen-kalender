import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';

/**
 * A single-line `.rk-field` bound to a Signal Forms field: text, date or time.
 *
 * These three share one component because they share the exact same markup and accessibility
 * contract, and only differ in the native `type` attribute - a separate component per `type` would
 * just be the same template copied three times. See `docs/architecture/design-system.md#field-input-and-error`
 * for the contract this reproduces: a real `<label for>`, an error wrapper that is always in the
 * DOM (`aria-live="polite" aria-atomic="true"`), and `aria-invalid`/`aria-describedby` bound only
 * once the field has been touched.
 */
@Component({
  selector: 'app-text-field',
  // `id` is a plain `@Input`, so a static `id="…"` in a consumer's template also reflects onto
  // this host element by default - duplicating the id the inner `<input>` needs for `<label for>`.
  // `[attr.id]: null` strips it back off the host once Angular applies host bindings.
  host: { class: 'block', '[attr.id]': 'null' },
  imports: [FormField],
  templateUrl: './text-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextField {
  /** Also used to derive the error message's id, so keep it unique on the page. */
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly field = input.required<Field<string>>();
  readonly type = input<'text' | 'date' | 'time'>('text');
  /**
   * Not just decoration: `.rk-field` grows its border once the input is non-empty, driven by
   * `:not(:placeholder-shown)`, which only ever matches when the input actually carries a
   * `placeholder` attribute.
   */
  readonly placeholder = input<string>('');
  readonly hint = input<string | null>(null);
  readonly autocomplete = input<string>('off');

  protected readonly state = computed(() => this.field()());
  protected readonly showError = computed(() => this.state().touched() && this.state().invalid());
  protected readonly errorMessage = computed(() => this.state().errors()[0]?.message ?? '');
  protected readonly errorId = computed(() => `${this.id()}-error`);
}
