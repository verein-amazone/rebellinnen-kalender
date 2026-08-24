import { ChangeDetectionStrategy, Component, inject, InjectionToken, signal } from '@angular/core';

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
 * The curated colour swatches offered in the identity editor, grouped by hue (reds/pinks,
 * purples/indigo, blues/teals, greens/yellow, oranges/browns/neutrals) — the same 30-colour set the
 * approved prototype design uses. Every swatch gets a distinct German name for the radio's
 * accessible name; the hex alone is not a usable label for assistive technology.
 */
export const CALENDAR_COLOR_PALETTE: readonly { readonly hex: string; readonly name: string }[] = [
  { hex: '#E92F2A', name: 'Rot' },
  { hex: '#FF6B6B', name: 'Korallrot' },
  { hex: '#FF8FA3', name: 'Rosa' },
  { hex: '#F48FB1', name: 'Pink' },
  { hex: '#CE93D8', name: 'Flieder' },
  { hex: '#BA68C8', name: 'Orchidee' },
  { hex: '#7B3FA8', name: 'Lila' },
  { hex: '#9C27B0', name: 'Violett' },
  { hex: '#673AB7', name: 'Indigo' },
  { hex: '#5C6BC0', name: 'Kornblumenblau' },
  { hex: '#3F51B5', name: 'Ultramarin' },
  { hex: '#1565C0', name: 'Blau' },
  { hex: '#168CA0', name: 'Petrol' },
  { hex: '#0288D1', name: 'Himmelblau' },
  { hex: '#00ACC1', name: 'Türkis' },
  { hex: '#7DBDBB', name: 'Seegrün' },
  { hex: '#4DB6AC', name: 'Mintgrün' },
  { hex: '#26A69A', name: 'Smaragd' },
  { hex: '#4CAF82', name: 'Waldgrün' },
  { hex: '#43A047', name: 'Grün' },
  { hex: '#66BB6A', name: 'Hellgrün' },
  { hex: '#8BC34A', name: 'Limette' },
  { hex: '#F5C518', name: 'Gelb' },
  { hex: '#FFD54F', name: 'Honiggelb' },
  { hex: '#F28A2E', name: 'Orange' },
  { hex: '#FF9800', name: 'Kürbis' },
  { hex: '#FF7043', name: 'Ziegelrot' },
  { hex: '#8D6E63', name: 'Taupe' },
  { hex: '#795548', name: 'Braun' },
  { hex: '#607D8B', name: 'Schiefergrau' },
];

/**
 * Changes a calendar's name, colour and emoji — the app calendar's own identity editor, opened from
 * `CalendarsPage`.
 *
 * Closes with the new identity, or `undefined` when the change is cancelled or the sheet is
 * dismissed, mirroring `ReminderEditDialog`. Colour is a curated swatch grid rather than a free
 * colour input — with only 30 possible values it stays easy to keep every one legible against the
 * app's surfaces, unlike an arbitrary user-picked hex. Emoji goes through
 * the `EMOJI_PICKER` token, the same `@independo/capacitor-emoji-picker` flow `ProfileInteractor`
 * already uses for the Today greeting's personal emoji, instead of a free-text field relying on the
 * OS emoji keyboard. The caller supplies the token per `SheetService.open()` call so both app-owned
 * and ICS calendars can reuse this one editor without coupling it to either interactor.
 */
@Component({
  selector: 'app-calendar-identity-edit',
  host: { class: 'block' },
  templateUrl: './calendar-identity-edit.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarIdentityEditDialog {
  private readonly data = inject(SHEET_DATA) as CalendarIdentityEditDialogData;
  private readonly sheetRef = inject<SheetRef<CalendarIdentityEditResult>>(SheetRef);
  private readonly pickEmojiFn = inject(EMOJI_PICKER);

  protected readonly maxLength = CALENDAR_NAME_MAX_LENGTH;
  protected readonly palette = CALENDAR_COLOR_PALETTE;
  protected readonly name = signal(this.data.name);
  protected readonly color = signal(this.data.color ?? CALENDAR_COLOR_PALETTE[0].hex);
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
