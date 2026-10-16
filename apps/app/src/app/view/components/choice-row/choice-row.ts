import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * One option in a radio group, rendered as a card row.
 *
 * This exists to hold the markup that would otherwise be repeated on every settings screen, not to
 * reimplement radio behaviour: the control inside is a native `<input type="radio">`, so grouping,
 * arrow-key navigation and position announcements come from the platform. Put the options inside a
 * `<fieldset>` with a `<legend>` and give them all the same `name`.
 */
@Component({
  selector: 'app-choice-row',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  templateUrl: './choice-row.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChoiceRow<T extends string = string> {
  /** Shared by every option in one group. This is what makes the browser treat them as a group. */
  readonly name = input.required<string>();
  readonly value = input.required<T>();
  readonly label = input.required<string>();
  /** Secondary line under the label. Becomes part of the option's accessible name. */
  readonly description = input<string | null>(null);
  readonly checked = input.required<boolean>();

  /** Emitted with this option's value when the user picks it. */
  readonly selected = output<T>();
}
