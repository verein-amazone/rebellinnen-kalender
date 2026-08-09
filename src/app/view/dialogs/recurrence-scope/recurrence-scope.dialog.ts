import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export type RecurrenceScope = 'occurrence' | 'following' | 'all';

export interface RecurrenceScopeDialogData {
  /** Context message explaining why the choice is needed. */
  readonly message: string;
}

/**
 * Asks which occurrences of a recurring appointment should be affected by an edit.
 *
 * Closes with the chosen `RecurrenceScope` ('occurrence', 'following', or 'all') when confirmed;
 * dismissing the sheet through Escape or the backdrop yields `undefined`, which callers treat as cancelled.
 */
@Component({
  selector: 'app-recurrence-scope',
  host: { class: 'block' },
  imports: [ChoiceRow],
  templateUrl: './recurrence-scope.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrenceScopeDialog {
  protected readonly data = inject(SHEET_DATA) as RecurrenceScopeDialogData;
  private readonly sheetRef = inject<SheetRef<RecurrenceScope>>(SheetRef);

  protected readonly selectedScope = signal<RecurrenceScope>('occurrence');

  protected confirm(): void {
    this.sheetRef.close(this.selectedScope());
  }

  protected cancel(): void {
    this.sheetRef.close(undefined);
  }
}
