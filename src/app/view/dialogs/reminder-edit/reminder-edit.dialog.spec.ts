import { TestBed } from '@angular/core/testing';

import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import { ReminderEditDialog } from './reminder-edit.dialog';

async function setup(text: string) {
  const results: (string | undefined)[] = [];
  const sheetRef = { close: (result?: string) => results.push(result) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: { text } },
      { provide: SheetRef, useValue: sheetRef },
    ],
  });

  const fixture = TestBed.createComponent(ReminderEditDialog);
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    results,
    input: element.querySelector('input')!,
    form: element.querySelector('form')!,
    async type(value: string) {
      this.input.value = value;
      this.input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    async submit() {
      this.form.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    },
  };
}

describe('ReminderEditDialog', () => {
  it('prefills the current text and labels the field', async () => {
    const { element, input } = await setup('Blumen gießen');

    expect(input.value).toBe('Blumen gießen');
    const label = element.querySelector('label');
    expect(label?.getAttribute('for')).toBe(input.id);
    expect(label?.textContent?.trim()).not.toBe('');
  });

  it('closes with the trimmed text when saved', async () => {
    const dialog = await setup('Blumen gießen');

    await dialog.type('  Blumen gießen und lüften ');
    await dialog.submit();

    expect(dialog.results).toEqual(['Blumen gießen und lüften']);
  });

  it('closes without a result when cancelled, so the entry stays as it was', async () => {
    const dialog = await setup('Blumen gießen');

    await dialog.type('Etwas anderes');
    dialog.element.querySelectorAll('button')[1].click();

    expect(dialog.results).toEqual([undefined]);
  });

  it('keeps the live region in the DOM before anything goes wrong', async () => {
    const { element } = await setup('Blumen gießen');

    expect(element.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(element.querySelector('.rk-error')).toBeNull();
  });

  it('refuses to save empty text and describes the field by the error', async () => {
    const dialog = await setup('Blumen gießen');

    await dialog.type('   ');
    await dialog.submit();

    expect(dialog.results).toEqual([]);
    const error = dialog.element.querySelector('.rk-error');
    expect(error?.textContent?.trim()).not.toBe('');
    expect(dialog.input.getAttribute('aria-invalid')).toBe('true');
    expect(dialog.input.getAttribute('aria-describedby')).toBe(error?.id);
  });
});
