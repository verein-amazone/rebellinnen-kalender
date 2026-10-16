import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Field } from '@angular/forms/signals';
import { FormField } from '@angular/forms/signals';

/** One choice in a radio group, rendered as a `.rk-choice` card row. */
export interface RadioGroupOption<T> {
  readonly value: T;
  readonly label: string;
  /** Folded into the same `<label>` as the option text, so it becomes part of the accessible name. */
  readonly description?: string;
}

/**
 * A `<fieldset>` of native radios bound to one Signal Forms field - the generic composer behind the
 * calendar picker and the recurrence-scope picker (#19).
 *
 * The control stays a native `<input type="radio">`: grouping, arrow-key navigation and position
 * announcements come from the platform, not from us (see
 * `docs/architecture/design-system.md#choice-row--choicecss--app-choice-row`). Every radio binds the
 * *same* `[formField]`; Signal Forms gives them the same `name` attribute, so a plain repeated
 * binding is enough to make them one group - no `name` input needed here.
 *
 * `T extends string`: `@angular/forms/signals` compares a radio's native (always-string) `value`
 * against the field's model value with `===` to decide whether it is checked, so only string-valued
 * fields can bind through repeated `[formField]` this way. A boolean choice - an on/off setting -
 * is a custom `FormCheckboxControl` instead; see `toggle-field.ts`.
 */
@Component({
  selector: 'app-radio-group-field',
  // `id` is a plain `@Input`, so a static `id="…"` in a consumer's template also reflects onto
  // this host element by default - duplicating the id the error paragraph's `aria-describedby`
  // points at. `[attr.id]: null` strips it back off the host once host bindings apply.
  host: { class: 'block', '[attr.id]': 'null' },
  imports: [FormField],
  templateUrl: './radio-group-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioGroupField<T extends string> {
  readonly legend = input.required<string>();
  /** `sr-only` the legend when a heading already visible above the group says the same thing. */
  readonly legendHidden = input<boolean>(false);
  readonly field = input.required<Field<T>>();
  readonly options = input.required<readonly RadioGroupOption<T>[]>();
  /** Also used to derive the error message's id, so keep it unique on the page. */
  readonly id = input.required<string>();

  protected readonly state = computed(() => this.field()());
  protected readonly showError = computed(() => this.state().touched() && this.state().invalid());
  protected readonly errorMessage = computed(() => this.state().errors()[0]?.message ?? '');
  protected readonly errorId = computed(() => `${this.id()}-error`);
}
