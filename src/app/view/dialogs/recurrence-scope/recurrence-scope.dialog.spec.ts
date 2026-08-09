import { TestBed } from '@angular/core/testing';

import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import { RecurrenceScopeDialog, type RecurrenceScopeDialogData } from './recurrence-scope.dialog';

/**
 * The content component is tested on its own, without the sheet chrome: the chrome has its own spec,
 * and going through `SheetService` here would only add the focus trap and the exit animation that
 * jsdom cannot run.
 */
async function setup(data: RecurrenceScopeDialogData) {
  const results: (string | undefined)[] = [];
  const sheetRef = { close: (result?: string) => results.push(result) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: data },
      { provide: SheetRef, useValue: sheetRef },
    ],
  });

  const fixture = TestBed.createComponent(RecurrenceScopeDialog);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, results };
}

const testData: RecurrenceScopeDialogData = {
  message: 'Wie soll der Termin geändert werden?',
};

describe('RecurrenceScopeDialog', () => {
  it('displays the message', async () => {
    const { element } = await setup(testData);

    expect(element.textContent).toContain('Wie soll der Termin geändert werden?');
  });

  it('renders a fieldset with three radio options', async () => {
    const { element } = await setup(testData);

    const fieldset = element.querySelector('fieldset');
    expect(fieldset).toBeTruthy();

    const radios = Array.from(element.querySelectorAll('input[type="radio"]'));
    expect(radios).toHaveLength(3);
  });

  it('offers the correct recurrence scope options', async () => {
    const { element } = await setup(testData);

    const radios = Array.from(
      element.querySelectorAll('input[type="radio"]'),
    ) as HTMLInputElement[];
    const values = radios.map((r) => r.value);

    expect(values).toEqual(['occurrence', 'following', 'all']);
  });

  it('displays the correct labels for each option', async () => {
    const { element } = await setup(testData);

    const labels = Array.from(element.querySelectorAll('label'));
    const labelTexts = labels.map((l) => l.textContent?.trim());

    expect(labelTexts).toContain('Nur dieser Termin');
    expect(labelTexts).toContain('Dieser und folgende Termine');
    expect(labelTexts).toContain('Alle Termine');
  });

  it('closes with the selected scope when confirmed', async () => {
    const { element, results } = await setup(testData);

    const radios = Array.from(
      element.querySelectorAll('input[type="radio"]'),
    ) as HTMLInputElement[];
    const confirmBtn = element.querySelector(
      'button[type="button"]:first-of-type',
    ) as HTMLButtonElement;

    // Select "following"
    radios[1].click();
    confirmBtn.click();

    expect(results).toEqual(['following']);
  });

  it('closes with undefined when cancelled', async () => {
    const { element, results } = await setup(testData);

    const cancelBtn = element.querySelector(
      'button[type="button"]:last-of-type',
    ) as HTMLButtonElement;

    cancelBtn.click();

    expect(results).toEqual([undefined]);
  });

  it('renders buttons in a stacked footer', async () => {
    const { element } = await setup(testData);

    const footer = element.querySelector('.rk-sheet-footer.flex-col');
    expect(footer).toBeTruthy();

    const buttons = Array.from(footer?.querySelectorAll('button') || []);
    expect(buttons).toHaveLength(2);
  });

  it('has a confirm button and a cancel button', async () => {
    const { element } = await setup(testData);

    const buttons = Array.from(element.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons[0].textContent?.trim()).toBe('Bestätigen');
    expect(buttons[1].textContent?.trim()).toBe('Abbrechen');
  });
});
