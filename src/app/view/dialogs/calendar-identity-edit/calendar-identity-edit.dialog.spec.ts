import { TestBed } from '@angular/core/testing';

import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import {
  CalendarIdentityEditDialog,
  type CalendarIdentityEditDialogData,
  type CalendarIdentityEditResult,
} from './calendar-identity-edit.dialog';

async function setup(data: CalendarIdentityEditDialogData) {
  const results: (CalendarIdentityEditResult | undefined)[] = [];
  const sheetRef = { close: (result?: CalendarIdentityEditResult) => results.push(result) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: data },
      { provide: SheetRef, useValue: sheetRef },
    ],
  });

  const fixture = TestBed.createComponent(CalendarIdentityEditDialog);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    results,
    nameInput: element.querySelector<HTMLInputElement>('#calendar-identity-name')!,
    colorInput: element.querySelector<HTMLInputElement>('#calendar-identity-color')!,
    emojiInput: element.querySelector<HTMLInputElement>('#calendar-identity-emoji')!,
    form: element.querySelector('form')!,
    async type(input: HTMLInputElement, value: string) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    async submit() {
      this.form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    },
  };
}

describe('CalendarIdentityEditDialog', () => {
  it('prefills the current name, colour and emoji', async () => {
    const { nameInput, colorInput, emojiInput } = await setup({
      name: 'Mein Kalender',
      color: '#336699',
      emoji: '🗓️',
    });

    expect(nameInput.value).toBe('Mein Kalender');
    expect(colorInput.value).toBe('#336699');
    expect(emojiInput.value).toBe('🗓️');
  });

  it('falls back to a default colour and an empty emoji field when neither is set', async () => {
    const { colorInput, emojiInput } = await setup({
      name: 'Mein Kalender',
      color: null,
      emoji: null,
    });

    expect(colorInput.value).not.toBe('');
    expect(emojiInput.value).toBe('');
  });

  it('closes with the trimmed name, the chosen colour and the emoji, or null when cleared', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: '#336699', emoji: '🗓️' });

    await dialog.type(dialog.nameInput, '  Vereinstermine  ');
    await dialog.type(dialog.colorInput, '#aa3377');
    await dialog.type(dialog.emojiInput, '  ');
    await dialog.submit();

    expect(dialog.results).toEqual([{ name: 'Vereinstermine', color: '#aa3377', emoji: null }]);
  });

  it('closes without a result when cancelled', async () => {
    const dialog = await setup({ name: 'Mein Kalender', color: null, emoji: null });

    dialog.element.querySelectorAll('button')[1].click();

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
});
