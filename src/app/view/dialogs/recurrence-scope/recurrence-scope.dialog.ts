import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LucideCheck, LucideTrash2, LucideX } from '@lucide/angular';

import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export type RecurrenceScope = 'occurrence' | 'following' | 'all';

export interface RecurrenceScopeDialogData {
  /** Context message explaining why the choice is needed. */
  readonly message: string;
  /**
   * `false` hides „Nur dieser Termin“ - for a changed repetition, which always describes the
   * series. Defaults to `true`.
   */
  readonly allowSingleOccurrence?: boolean;
  /** The verb on the confirming button. Defaults to „Bestätigen“. */
  readonly confirmLabel?: string;
  /**
   * Renders the confirmation as destructive, like `ConfirmationDialog`: the danger colour plus a bin,
   * never the colour alone. For a delete, where this sheet is the only confirmation (#152).
   */
  readonly destructive?: boolean;
}

/**
 * Asks which occurrences of a recurring appointment an edit or a delete should affect.
 *
 * Closes with the chosen `RecurrenceScope` ('occurrence', 'following', or 'all') when confirmed;
 * dismissing the sheet through Escape or the backdrop yields `undefined`, which callers treat as cancelled.
 */
@Component({
  selector: 'app-recurrence-scope',
  host: { class: 'block' },
  imports: [ChoiceRow, LucideCheck, LucideTrash2, LucideX],
  templateUrl: './recurrence-scope.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrenceScopeDialog {
  protected readonly data = inject(SHEET_DATA) as RecurrenceScopeDialogData;
  private readonly sheetRef = inject<SheetRef<RecurrenceScope>>(SheetRef);

  protected readonly allowSingleOccurrence = this.data.allowSingleOccurrence ?? true;
  protected readonly confirmLabel = this.data.confirmLabel ?? 'Bestätigen';
  protected readonly destructive = this.data.destructive === true;
  protected readonly selectedScope = signal<RecurrenceScope>(
    this.allowSingleOccurrence ? 'occurrence' : 'following',
  );

  protected confirm(): void {
    this.sheetRef.close(this.selectedScope());
  }

  protected cancel(): void {
    this.sheetRef.close(undefined);
  }
}
