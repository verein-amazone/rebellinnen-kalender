import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';

/**
 * A multi-line `.rk-field` bound to a Signal Forms field — used for an appointment's note.
 *
 * Same accessibility contract as `TextField`: a real `<label for>`, an always-in-DOM `aria-live`
 * error wrapper, and `aria-invalid`/`aria-describedby` bound only once touched. See
 * `docs/architecture/design-system.md#field-input-and-error`.
 */
@Component({
  selector: 'app-textarea-field',
  // `id` is a plain `@Input`, so a static `id="…"` in a consumer's template also reflects onto
  // this host element by default — duplicating the id the inner `<textarea>` needs for
  // `<label for>`. `[attr.id]: null` strips it back off the host once host bindings apply.
  host: { class: 'block', '[attr.id]': 'null' },
  imports: [FormField],
  templateUrl: './textarea-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaField {
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly field = input.required<Field<string>>();
  readonly placeholder = input<string>('');
  readonly hint = input<string | null>(null);
  readonly rows = input<number>(3);

  protected readonly state = computed(() => this.field()());
  protected readonly showError = computed(() => this.state().touched() && this.state().invalid());
  protected readonly errorMessage = computed(() => this.state().errors()[0]?.message ?? '');
  protected readonly errorId = computed(() => `${this.id()}-error`);
}
