import { TestBed } from '@angular/core/testing';

import type { WritableAppCalendar } from '@app/interactors/calendar/app-calendars.interactor';
import { SHEET_DATA, SheetRef } from '@app/view/components/sheet/sheet-ref';

import { CalendarPickerDialog, type CalendarPickerDialogData } from './calendar-picker.dialog';

const calendarPrivate: WritableAppCalendar = {
  id: 'cal-privat',
  name: 'Privat',
  color: '#a1b2c3',
  emoji: '🏠',
};
const calendarVerein: WritableAppCalendar = {
  id: 'cal-verein',
  name: 'Verein',
  color: '#c3b2a1',
  emoji: null,
};

/**
 * Tested on its own, without the sheet chrome — the chrome has its own spec, and going through
 * `SheetService` here would only add the focus trap and the exit animation that jsdom cannot run.
 */
async function setup(data: CalendarPickerDialogData) {
  const results: (string | undefined)[] = [];
  const sheetRef = { close: (result?: string) => results.push(result) };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: SHEET_DATA, useValue: data },
      { provide: SheetRef, useValue: sheetRef },
    ],
  });

  const fixture = TestBed.createComponent(CalendarPickerDialog);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, results };
}

describe('CalendarPickerDialog', () => {
  it('lists every calendar by name', async () => {
    const { element } = await setup({
      calendars: [calendarPrivate, calendarVerein],
      selectedId: 'cal-privat',
    });

    expect(element.textContent).toContain('Privat');
    expect(element.textContent).toContain('Verein');
  });

  it('marks the selected calendar with a checkmark and the others without one', async () => {
    const { element } = await setup({
      calendars: [calendarPrivate, calendarVerein],
      selectedId: 'cal-privat',
    });

    const buttons = Array.from(element.querySelectorAll('button'));
    const privateButton = buttons.find((button) => button.textContent?.includes('Privat'));
    const vereinButton = buttons.find((button) => button.textContent?.includes('Verein'));

    expect(privateButton?.querySelector('svg')).not.toBeNull();
    expect(vereinButton?.querySelector('svg')).toBeNull();
  });

  it('closes with the tapped calendar id, immediately, without a separate confirm step', async () => {
    const { element, results } = await setup({
      calendars: [calendarPrivate, calendarVerein],
      selectedId: 'cal-privat',
    });

    const vereinButton = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Verein'),
    );
    vereinButton!.click();

    expect(results).toEqual(['cal-verein']);
  });
});
