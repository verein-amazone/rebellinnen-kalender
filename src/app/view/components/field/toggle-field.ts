import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import type {
  FormCheckboxControl,
  ValidationError,
  WithOptionalFieldTree,
} from '@angular/forms/signals';

/**
 * A reusable on/off switch for a single boolean field, e.g. `<app-toggle-field [formField]="…" />`.
 *
 * The control stays a native `<input type="checkbox">` — `role="switch"` only changes how the
 * accessible role and state are announced, which every major screen reader supports for this
 * pattern (it is the same technique Angular Material's own slide toggle uses). Space/Enter,
 * `checked`, and label association therefore all stay the browser's, not ours.
 */
@Component({
  selector: 'app-toggle-field',
  host: { class: 'block', '[attr.id]': 'null' },
  templateUrl: './toggle-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleField implements FormCheckboxControl {
  /** Used to derive the error message's id, so keep it unique on the page. */
  readonly id = input.required<string>();
  readonly label = input.required<string>();

  /** Required by `FormCheckboxControl`; bound to the field's value by `[formField]`. */
  readonly checked = model<boolean>(false);

  // Optional `FormUiControl` state, wired the same way the Signal Forms docs' `StatefulInput`
  // example does, so this control participates in touched/invalid like a built-in one.
  readonly touched = input<boolean>(false);
  readonly touch = output<void>();
  readonly invalid = input<boolean>(false);
  readonly errors = input<readonly WithOptionalFieldTree<ValidationError>[]>([]);

  protected readonly errorId = computed(() => `${this.id()}-error`);
  protected readonly showError = computed(() => this.touched() && this.invalid());
  protected readonly errorMessage = computed(() => this.errors()[0]?.message ?? '');

  protected onChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
