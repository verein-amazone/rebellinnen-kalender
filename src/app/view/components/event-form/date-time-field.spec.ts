import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { DateTimeField } from './date-time-field';

@Component({
  imports: [DateTimeField],
  template: `
    <app-date-time-field
      id="event-form-date-time"
      [dateField]="form.date"
      [startTimeField]="form.startTime"
      [endDateField]="form.endDate"
      [endTimeField]="form.endTime"
      [allDayField]="form.allDay"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly model = signal({
    date: '2026-08-08',
    startTime: '13:00',
    endDate: '2026-08-08',
    endTime: '14:00',
    allDay: false,
  });
  readonly form = form(this.model);
}

async function setup() {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const toggleButton = element.querySelector<HTMLButtonElement>('button')!;

  return {
    fixture,
    element,
    toggleButton,
    async expand() {
      toggleButton.click();
      await fixture.whenStable();
    },
  };
}

describe('DateTimeField', () => {
  it('starts collapsed, showing only the summary row', async () => {
    const { element, toggleButton } = await setup();

    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('#event-form-date-time-start-date')).toBeNull();
  });

  it('summarises the collapsed row with the date and time range', async () => {
    const { toggleButton } = await setup();

    expect(toggleButton.textContent).toContain('13:00–14:00');
  });

  it('mentions the end date in the summary once it differs from the start date', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.model.set({
      date: '2026-08-10',
      startTime: '22:00',
      endDate: '2026-08-11',
      endTime: '02:00',
      allDay: false,
    });
    await fixture.whenStable();
    const toggleButton = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(toggleButton.textContent).toContain('22:00–');
    expect(toggleButton.textContent).toContain('11. Aug');
    expect(toggleButton.textContent).toContain('02:00');
  });

  it('summarises all-day with "Ganztägig" instead of a time range', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.model.set({
      date: '2026-08-08',
      startTime: '',
      endDate: '',
      endTime: '',
      allDay: true,
    });
    await fixture.whenStable();
    const toggleButton = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(toggleButton.textContent).toContain('Ganztägig');
  });

  it('mentions the end date in an all-day summary once it spans multiple days', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.model.set({
      date: '2026-08-08',
      startTime: '',
      endDate: '2026-08-10',
      endTime: '',
      allDay: true,
    });
    await fixture.whenStable();
    const toggleButton = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(toggleButton.textContent).toContain('Ganztägig');
    expect(toggleButton.textContent).toContain('10. Aug');
  });

  it('expands to show Starts, Ends and Ganztägig on tap', async () => {
    const { element, expand } = await setup();

    await expand();

    expect(element.querySelector<HTMLInputElement>('#event-form-date-time-start-date')?.value).toBe(
      '2026-08-08',
    );
    expect(element.querySelector<HTMLInputElement>('#event-form-date-time-start-time')?.value).toBe(
      '13:00',
    );
    expect(element.querySelector<HTMLInputElement>('#event-form-date-time-end-date')?.value).toBe(
      '2026-08-08',
    );
    expect(element.querySelector<HTMLInputElement>('#event-form-date-time-end-time')?.value).toBe(
      '14:00',
    );
    expect(element.querySelector('.rk-toggle')).not.toBeNull();
  });

  it('hides only the time inputs, keeping both date inputs, once Ganztägig is switched on', async () => {
    const { fixture, element, expand } = await setup();
    await expand();

    const toggle = element.querySelector<HTMLInputElement>('.rk-toggle')!;
    toggle.click();
    await fixture.whenStable();

    expect(element.querySelector('#event-form-date-time-start-date')).not.toBeNull();
    expect(element.querySelector('#event-form-date-time-start-time')).toBeNull();
    expect(element.querySelector('#event-form-date-time-end-date')).not.toBeNull();
    expect(element.querySelector('#event-form-date-time-end-time')).toBeNull();
    expect(fixture.componentInstance.model().allDay).toBe(true);
  });

  it('lets the end date move to a later day while Ganztägig is on, for a multi-day all-day appointment', async () => {
    const { fixture, element, expand } = await setup();
    await expand();

    const toggle = element.querySelector<HTMLInputElement>('.rk-toggle')!;
    toggle.click();
    await fixture.whenStable();

    const endDateInput = element.querySelector<HTMLInputElement>('#event-form-date-time-end-date')!;
    endDateInput.value = '2026-08-10';
    endDateInput.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(fixture.componentInstance.model().endDate).toBe('2026-08-10');
  });

  it('fills a default start/end time when switching Ganztägig off from an occurrence that had none', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.model.set({
      date: '2026-08-08',
      startTime: '',
      endDate: '2026-08-08',
      endTime: '',
      allDay: true,
    });
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();

    const toggle = element.querySelector<HTMLInputElement>('.rk-toggle')!;
    toggle.click();
    await fixture.whenStable();

    const model = fixture.componentInstance.model();
    expect(model.allDay).toBe(false);
    expect(model.startTime).not.toBe('');
    expect(model.endTime).not.toBe('');
  });

  it('leaves an already-set start/end time untouched when switching Ganztägig off', async () => {
    const { fixture, element, expand } = await setup();
    await expand();

    const toggle = element.querySelector<HTMLInputElement>('.rk-toggle')!;
    toggle.click();
    await fixture.whenStable();
    toggle.click();
    await fixture.whenStable();

    const model = fixture.componentInstance.model();
    expect(model.startTime).toBe('13:00');
    expect(model.endTime).toBe('14:00');
  });
});
