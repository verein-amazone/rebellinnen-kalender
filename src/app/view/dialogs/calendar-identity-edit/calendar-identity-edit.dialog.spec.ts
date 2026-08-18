import { TestBed } from '@angular/core/testing';

import { AppCalendarsInteractor } from '@app/interactors/calendar/app-calendars.interactor';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import {
  CALENDAR_COLOR_PALETTE,
  CalendarIdentityEditDialog,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from './calendar-identity-edit.dialog';

class FakeAppCalendarsInteractor {
  pickedEmoji: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.pickedEmoji);
  }
}

async function setup(data: CalendarIdentityEditDialogData) {
  const results: (CalendarIdentityEditResult | undefined)[] = [];
  const sheetRef = { close: (result?: CalendarIdentityEditResult) => results.push(result) };
  const appCalendars = new FakeAppCalendarsInteractor();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: data },
      { provide: SheetRef, useValue: sheetRef },
      { provide: AppCalendarsInteractor, useValue: appCalendars },
    ],
  });

  const fixture = TestBed.createComponent(CalendarIdentityEditDialog);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  function buttonNamed(text: string): HTMLButtonElement {
    const button = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(text),
    );
    if (button === undefined) {
      throw new Error(`No button contains "${text}"`);
    }
    return button;
  }

  return {
    element,
    results,
    appCalendars,
    nameInput: element.querySelector<HTMLInputElement>('#calendar-identity-name')!,
    colorSwatch: (hex: string) =>
      element.querySelector<HTMLInputElement>(`input[type="radio"][value="${hex}"]`)!,
    previewPill: element.querySelector<HTMLElement>('.rk-pill')!,
    emojiButton: element.querySelector<HTMLButtonElement>('#calendar-identity-emoji-picker')!,
    form: element.querySelector('form')!,
    buttonNamed,
    async type(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    async selectColor(hex: string) {
      const swatch = element.querySelector<HTMLInputElement>(
        `input[type="radio"][value="${hex}"]`,
      )!;
      swatch.checked = true;
      swatch.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    },
    async pickEmoji() {
      element.querySelector<HTMLButtonElement>('#calendar-identity-emoji-picker')!.click();
      await fixture.whenStable();
    },
    async submit() {
      this.form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    },
  };
}

describe('CalendarIdentityEditDialog', () => {
  it('prefills the current name and selects the stored colour swatch', async () => {
    const color = CALENDAR_COLOR_PALETTE[3].hex;
    const { nameInput, colorSwatch } = await setup({
      name: 'Mein Kalender',
      color,
      emoji: '🗓️',
    });

    expect(nameInput.value).toBe('Mein Kalender');
    expect(colorSwatch(color).checked).toBe(true);
  });

  it('falls back to the palette’s first colour when none is stored', async () => {
    const { colorSwatch } = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    expect(colorSwatch(CALENDAR_COLOR_PALETTE[0].hex).checked).toBe(true);
  });

  it('shows the current emoji on the picker button and an „Entfernen“ action once one is set', async () => {
    const { emojiButton, element } = await setup({
      name: 'Mein Kalender',
      color: null,
      emoji: '🗓️',
    });

    expect(emojiButton.textContent).toContain('🗓️');
    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Entfernen'),
      ),
    ).toBe(true);
  });

  it('shows no „Entfernen“ action when no emoji is set', async () => {
    const { element } = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    expect(
      Array.from(element.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Entfernen'),
      ),
    ).toBe(false);
  });

  it('selecting a colour swatch updates the preview pill and the saved colour', async () => {
    const newColor = CALENDAR_COLOR_PALETTE[5].hex;
    const dialog = await setup({
      name: 'Mein Kalender',
      color: CALENDAR_COLOR_PALETTE[0].hex,
      emoji: null,
    });

    await dialog.selectColor(newColor);

    expect(dialog.previewPill.style.getPropertyValue('--pill-color')).toBe(newColor);

    await dialog.submit();
    expect(dialog.results).toEqual([{ name: 'Mein Kalender', color: newColor, emoji: null }]);
  });

  it('opens the emoji picker and adopts the picked emoji', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: null });
    dialog.appCalendars.pickedEmoji = '🌻';

    await dialog.pickEmoji();

    expect(dialog.emojiButton.textContent).toContain('🌻');

    await dialog.submit();
    expect(dialog.results).toEqual([
      { name: 'Mein Kalender', color: CALENDAR_COLOR_PALETTE[0].hex, emoji: '🌻' },
    ]);
  });

  it('leaves the emoji unchanged when the picker is dismissed without a selection', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: '🗓️' });
    dialog.appCalendars.pickedEmoji = null;

    await dialog.pickEmoji();

    expect(dialog.emojiButton.textContent).toContain('🗓️');
  });

  it('clears the emoji via „Entfernen“, which then disappears', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: '🗓️' });

    dialog.buttonNamed('Entfernen').click();
    await dialog.submit();

    expect(dialog.results).toEqual([
      { name: 'Mein Kalender', color: CALENDAR_COLOR_PALETTE[0].hex, emoji: null },
    ]);
  });

  it('closes without a result when cancelled', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    dialog.buttonNamed('Abbrechen').click();

    expect(dialog.results).toEqual([undefined]);
  });

  it('refuses to save an empty name and describes the field by the error', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    await dialog.type(dialog.nameInput, '   ');
    await dialog.submit();

    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('.rk-error');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(dialog.nameInput.getAttribute('aria-invalid')).toBe('true');
    expect(dialog.nameInput.getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('trims the name on save', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    await dialog.type(dialog.nameInput, '  Vereinstermine  ');
    await dialog.submit();

    expect(dialog.results).toEqual([
      { name: 'Vereinstermine', color: CALENDAR_COLOR_PALETTE[0].hex, emoji: null },
    ]);
  });
});
