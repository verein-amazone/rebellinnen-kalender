import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

import { TodayClosingMessage } from './today-closing-message';

function occurrence(): CalendarOccurrence {
  return {
    id: 'o1',
    sourceId: 's1',
    calendarId: 'c1',
    seriesId: null,
    originalStart: null,
    itemId: null,
    externalId: null,
    kind: 'event',
    title: 'Treffen AG Gleichstellung',
    location: null,
    description: null,
    allDay: false,
    start: { kind: 'floating', value: '2026-08-11T17:30:00', timeZone: null },
    end: { kind: 'floating', value: '2026-08-11T18:30:00', timeZone: null },
    startUtc: '2026-08-11T17:30:00Z',
    endUtc: '2026-08-11T18:30:00Z',
    startDay: '2026-08-11',
    endDay: '2026-08-11',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'App',
    calendarName: 'Privat',
    calendarColor: null,
    calendarEmoji: null,
  };
}

@Component({
  imports: [TodayClosingMessage],
  template: `<app-today-closing-message
    [headline]="headline"
    [supportingLine]="supportingLine"
    [appointment]="appointment"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  headline = 'Für heute ist alles erledigt';
  supportingLine: string | null = null;
  appointment: CalendarOccurrence | null = null;
}

describe('TodayClosingMessage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders the headline', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Für heute ist alles erledigt');
  });

  it('renders no supporting line when none is given', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="supporting-line"]')).toBeNull();
  });

  it('renders the supporting line when given', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.supportingLine = 'Mach dir einen schönen Tag.';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="supporting-line"]')?.textContent).toContain(
      'Mach dir einen schönen Tag.',
    );
  });

  it('never renders a bordered card unless an appointment preview is given', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.rk-card')).toBeNull();
  });

  it('renders a quiet appointment link when an appointment is given', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.appointment = occurrence();
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const link = element.querySelector('a[href]');
    expect(link?.textContent).toContain('Treffen AG Gleichstellung');
    expect(link?.classList.contains('rk-card')).toBe(false);
  });

  it('keeps the live region present even before there is a headline', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.headline = '';
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});
