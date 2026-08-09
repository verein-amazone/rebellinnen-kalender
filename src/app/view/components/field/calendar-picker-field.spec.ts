import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required } from '@angular/forms/signals';
import { Observable, of } from 'rxjs';

import type { WritableAppCalendar } from '@app/interactors/calendar/app-calendars.interactor';
import { SheetService } from '@app/view/components/sheet/sheet.service';

import { CalendarPickerField } from './calendar-picker-field';

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

class StubSheetService {
  results: unknown[] = [];
  opens: { heading: string; data: unknown }[] = [];

  open(
    _content: unknown,
    config: { heading: string; data?: unknown },
  ): { closed: Observable<unknown> } {
    this.opens.push({ heading: config.heading, data: config.data });
    return { closed: of(this.results.shift()) };
  }
}

@Component({
  imports: [CalendarPickerField],
  template: `
    <app-calendar-picker-field
      id="appointment-calendar"
      [field]="form.calendarId"
      [calendars]="calendars"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly calendars = [calendarPrivate, calendarVerein];
  readonly model = signal({ calendarId: 'cal-privat' });
  readonly form = form(this.model, (schemaPath) => {
    required(schemaPath.calendarId, { message: 'Bitte wähle einen Kalender.' });
  });
}

async function setup() {
  const sheets = new StubSheetService();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: SheetService, useValue: sheets }],
  });

  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();

  return {
    fixture,
    sheets,
    element: fixture.nativeElement as HTMLElement,
    button: (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '#appointment-calendar',
    )!,
  };
}

describe('CalendarPickerField', () => {
  it('labels the field "Kalender" the same way app-text-field does, plain text with no icon', async () => {
    const { element } = await setup();
    const label = element.querySelector('label.rk-label');
    expect(label?.textContent?.trim()).toBe('Kalender');
    expect(label?.querySelector('svg')).toBeNull();
  });

  it('shows the currently selected calendar by name', async () => {
    const { button } = await setup();
    expect(button.textContent).toContain('Privat');
  });

  it('opens the picker sheet with every calendar and the current selection', async () => {
    const { button, sheets } = await setup();

    button.click();

    expect(sheets.opens).toHaveLength(1);
    expect(sheets.opens[0].data).toEqual({
      calendars: [calendarPrivate, calendarVerein],
      selectedId: 'cal-privat',
    });
  });

  it('writes the picked calendar back into the form model', async () => {
    const { fixture, button, sheets } = await setup();
    sheets.results = ['cal-verein'];

    button.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().calendarId).toBe('cal-verein');
  });

  it('leaves the model untouched when the sheet is dismissed without a choice', async () => {
    const { fixture, button, sheets } = await setup();
    sheets.results = [undefined];

    button.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.model().calendarId).toBe('cal-privat');
  });

  it('does not open the sheet when there are no calendars to choose from', async () => {
    const { fixture, button, sheets } = await setup();
    fixture.componentInstance.calendars.length = 0;

    button.click();

    expect(sheets.opens).toEqual([]);
  });
});
