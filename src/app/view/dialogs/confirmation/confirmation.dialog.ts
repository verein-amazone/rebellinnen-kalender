import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCheck, LucideTrash2, LucideUnlink, LucideX } from '@lucide/angular';

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
  /**
   * The icon in front of the verb. Defaults to a bin when destructive and a check otherwise; pass
   * `unlink` where the action breaks a connection rather than deleting something.
   */
  readonly confirmIcon?: ConfirmationIcon;
}

export type ConfirmationIcon = 'check' | 'trash' | 'unlink';

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
  imports: [LucideCheck, LucideTrash2, LucideUnlink, LucideX],
  templateUrl: './confirmation.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  protected readonly data = inject(SHEET_DATA) as ConfirmationDialogData;
  private readonly sheetRef = inject<SheetRef<boolean>>(SheetRef);

  protected readonly confirmIcon: ConfirmationIcon =
    this.data.confirmIcon ?? (this.data.destructive === true ? 'trash' : 'check');

  protected confirm(): void {
    this.sheetRef.close(true);
  }

  protected cancel(): void {
    this.sheetRef.close(false);
  }
}
