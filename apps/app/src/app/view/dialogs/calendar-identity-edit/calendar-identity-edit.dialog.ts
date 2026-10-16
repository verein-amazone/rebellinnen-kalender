import { ChangeDetectionStrategy, Component, inject, InjectionToken, signal } from '@angular/core';
import { LucideCheck, LucideTrash2, LucideX } from '@lucide/angular';

import {
  CALENDAR_COLOR_PALETTE,
  DEFAULT_CALENDAR_COLOR,
} from '@app/interactors/calendar/calendar-colors';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

/** The dialog's colour/emoji-editing calendar name limit; ICS subscription names share it. */
export const CALENDAR_NAME_MAX_LENGTH = 200;

/**
 * Opens an emoji picker and resolves the chosen emoji, or `null` when dismissed. Injected rather
 * than a fixed interactor so this dialog serves both app-owned and ICS calendars.
 */
export const EMOJI_PICKER = new InjectionToken<() => Promise<string | null>>('EMOJI_PICKER');

export interface CalendarIdentityEditDialogData {
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

export interface CalendarIdentityEditResult {
  readonly name: string;
  readonly color: string | null;
  readonly emoji: string | null;
}

/**
 * Changes a calendar's name, colour and emoji - the app calendar's own identity editor, opened from
 * `CalendarsPage`.
 *
 * Closes with the new identity, or `undefined` when the change is cancelled or the sheet is
 * dismissed, mirroring `ReminderEditDialog`. Colour is a curated swatch grid rather than a free
 * colour input - with only 30 possible values it stays easy to keep every one legible against the
 * app's surfaces, unlike an arbitrary user-picked hex. Emoji goes through
 * the `EMOJI_PICKER` token, the same `@independo/capacitor-emoji-picker` flow `ProfileInteractor`
 * already uses for the Today greeting's personal emoji, instead of a free-text field relying on the
 * OS emoji keyboard. The caller supplies the token per `SheetService.open()` call so both app-owned
 * and ICS calendars can reuse this one editor without coupling it to either interactor.
 */
@Component({
  selector: 'app-calendar-identity-edit',
  host: { class: 'block' },
  imports: [LucideCheck, LucideTrash2, LucideX],
  templateUrl: './calendar-identity-edit.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarIdentityEditDialog {
  private readonly data = inject(SHEET_DATA) as CalendarIdentityEditDialogData;
  private readonly sheetRef = inject<SheetRef<CalendarIdentityEditResult>>(SheetRef);
  private readonly pickEmojiFn = inject(EMOJI_PICKER);
  private readonly haptics = inject(HapticsInteractor);

  protected readonly maxLength = CALENDAR_NAME_MAX_LENGTH;
  protected readonly palette = CALENDAR_COLOR_PALETTE;
  protected readonly name = signal(this.data.name);
  protected readonly color = signal(this.data.color ?? DEFAULT_CALENDAR_COLOR);
  protected readonly emoji = signal(this.data.emoji);
  protected readonly error = signal('');

  protected updateName(value: string): void {
    this.name.set(value);
    if (this.error() !== '') {
      this.error.set('');
    }
  }

  protected async pickEmoji(): Promise<void> {
    const emoji = await this.pickEmojiFn();
    if (emoji !== null) {
      this.emoji.set(emoji);
    }
  }

  protected selectColor(hex: string): void {
    this.color.set(hex);
    void this.haptics.selection();
  }

  protected clearEmoji(): void {
    this.emoji.set(null);
  }

  protected save(): void {
    const name = this.name().trim();
    if (name === '') {
      this.error.set('Bitte gib einen Namen ein.');
      return;
    }

    this.sheetRef.close({ name, color: this.color(), emoji: this.emoji() });
  }

  protected cancel(): void {
    this.sheetRef.close();
  }
}
