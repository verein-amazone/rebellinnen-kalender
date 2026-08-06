import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideTrash2 } from '@lucide/angular';

import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

export interface ConfirmationDialogData {
  /** What is about to happen, in full sentences. Name the affected thing here. */
  readonly message: string;
  /** The verb that carries out the action, for example „Löschen“. Never „OK“. */
  readonly confirmLabel: string;
  /** Defaults to „Abbrechen“. */
  readonly cancelLabel?: string;
  /** Renders the confirmation as destructive: the danger colour plus a matching icon. */
  readonly destructive?: boolean;
}

/**
 * Asks before an action that cannot be undone.
 *
 * Closes with `true` when the action is confirmed and `false` when it is declined; dismissing the
 * sheet through Escape or the backdrop yields `undefined`, which callers treat as declined.
 *
 * The destructive variant never relies on the colour alone: it pairs the danger colour with the
 * caller's verb and an icon, which is what the design system asks for.
 */
@Component({
  selector: 'app-confirmation',
  host: { class: 'block' },
  imports: [LucideTrash2],
  templateUrl: './confirmation.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  protected readonly data = inject(SHEET_DATA) as ConfirmationDialogData;
  private readonly sheetRef = inject<SheetRef<boolean>>(SheetRef);

  protected confirm(): void {
    this.sheetRef.close(true);
  }

  protected cancel(): void {
    this.sheetRef.close(false);
  }
}
