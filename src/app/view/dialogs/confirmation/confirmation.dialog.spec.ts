import { TestBed } from '@angular/core/testing';

import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import { ConfirmationDialog, type ConfirmationDialogData } from './confirmation.dialog';

/**
 * The content component is tested on its own, without the sheet chrome: the chrome has its own spec,
 * and going through `SheetService` here would only add the focus trap and the exit animation that
 * jsdom cannot run.
 */
async function setup(data: ConfirmationDialogData) {
  const results: (boolean | undefined)[] = [];
  const sheetRef = { close: (result?: boolean) => results.push(result) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: data },
      { provide: SheetRef, useValue: sheetRef },
    ],
  });

  const fixture = TestBed.createComponent(ConfirmationDialog);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, results };
}

const destructiveData: ConfirmationDialogData = {
  message: '„Blumen gießen“ wird gelöscht.',
  confirmLabel: 'Löschen',
  destructive: true,
};

describe('ConfirmationDialog', () => {
  it('names the action with a verb and states what will happen', async () => {
    const { element } = await setup(destructiveData);

    expect(element.textContent).toContain('„Blumen gießen“ wird gelöscht.');
    const [confirm, cancel] = Array.from(element.querySelectorAll('button'));
    expect(confirm.textContent?.trim()).toBe('Löschen');
    expect(cancel.textContent?.trim()).toBe('Abbrechen');
  });

  it('signals a destructive action with an icon as well as the colour', async () => {
    const { element } = await setup(destructiveData);

    const [confirm] = Array.from(element.querySelectorAll('button'));
    expect(confirm.classList).toContain('rk-button-danger');
    expect(confirm.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('closes with true when confirmed and false when declined', async () => {
    const { element, results } = await setup(destructiveData);
    const [confirm, cancel] = Array.from(element.querySelectorAll('button'));

    confirm.click();
    cancel.click();

    expect(results).toEqual([true, false]);
  });

  it('renders a non-destructive confirmation without the danger cue', async () => {
    const { element } = await setup({
      message: 'Fortfahren?',
      confirmLabel: 'Weiter',
      cancelLabel: 'Zurück',
    });

    const [confirm, cancel] = Array.from(element.querySelectorAll('button'));
    expect(confirm.classList).toContain('rk-button-primary');
    expect(confirm.querySelector('svg')).toBeNull();
    expect(cancel.textContent?.trim()).toBe('Zurück');
  });
});
