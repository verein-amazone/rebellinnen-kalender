/**
 * One selectable option of a settings choice, ready to be rendered as a radio-style row.
 *
 * Interactors own these lists including their German wording, so every screen offering the same
 * choice says the same thing.
 */
export interface ChoiceOption<TId extends string> {
  readonly id: TId;
  readonly label: string;
  /** Shown below the label where it helps users understand the option. */
  readonly description: string | null;
}
