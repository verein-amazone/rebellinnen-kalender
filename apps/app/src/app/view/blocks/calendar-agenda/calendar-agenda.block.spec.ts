import { Component, input, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

import { CalendarAgendaBlock } from './calendar-agenda.block';

function occurrence(overrides: Partial<CalendarOccurrence> = {}): CalendarOccurrence {
  return {
    id: 'occ-1',
    sourceId: 'source-1',
    calendarId: 'calendar-1',
    seriesId: null,
    originalStart: null,
    itemId: null,
    externalId: null,
    kind: 'event',
    title: 'Workshop',
    location: null,
    description: null,
    allDay: false,
    start: { kind: 'zoned', value: '2026-08-05T09:30:00', timeZone: 'Europe/Vienna' },
    end: { kind: 'zoned', value: '2026-08-05T11:00:00', timeZone: 'Europe/Vienna' },
    startUtc: '2026-08-05T07:30:00Z',
    endUtc: '2026-08-05T09:00:00Z',
    startDay: '2026-08-05',
    endDay: '2026-08-05',
    actions: { editableInApp: true, deletableInApp: true, editViaNativeCalendar: false },
    stale: false,
    sourceName: 'Meine Kalender',
    calendarName: 'Mein Kalender',
    calendarColor: '#7b3fa8',
    calendarEmoji: '📅',
    ...overrides,
  };
}

@Component({
  imports: [CalendarAgendaBlock],
  template: `
    <app-calendar-agenda
      [day]="day()"
      [occurrences]="occurrences()"
      [sourcesHidden]="sourcesHidden()"
      [view]="view()"
      timeZone="+0200"
    />
  `,
})
class Host {
  readonly day = input.required<string>();
  readonly occurrences = input.required<readonly CalendarOccurrence[]>();
  readonly sourcesHidden = input(false);
  readonly view = input<string>();
}

async function setup(
  day: string,
  occurrences: readonly CalendarOccurrence[],
  sourcesHidden = false,
  view?: string,
): Promise<{ element: HTMLElement }> {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'de' }],
  });

  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('day', day);
  fixture.componentRef.setInput('occurrences', occurrences);
  fixture.componentRef.setInput('sourcesHidden', sourcesHidden);
  fixture.componentRef.setInput('view', view);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('CalendarAgendaBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('heads the list with the full selected date', async () => {
    const { element } = await setup('2026-08-05', []);

    const heading = element.querySelector('h2');
    expect(heading?.textContent).toContain('Mittwoch, 5. August 2026');
  });

  it('shows only occurrences that touch the selected day', async () => {
    const { element } = await setup('2026-08-05', [
      occurrence({ id: 'a', title: 'Heute' }),
      occurrence({ id: 'b', title: 'Morgen', startDay: '2026-08-06', endDay: '2026-08-06' }),
      occurrence({ id: 'c', title: 'Mehrtägig', startDay: '2026-08-03', endDay: '2026-08-07' }),
    ]);

    expect(element.textContent).toContain('Heute');
    expect(element.textContent).toContain('Mehrtägig');
    expect(element.textContent).not.toContain('Morgen');
  });

  it('lists all-day and spanning entries before timed ones, keeping the given order within groups', async () => {
    const { element } = await setup('2026-08-05', [
      occurrence({ id: 'timed-1', title: 'Erster Termin' }),
      occurrence({ id: 'timed-2', title: 'Zweiter Termin' }),
      occurrence({
        id: 'span',
        title: 'Ferienwoche',
        startDay: '2026-08-03',
        endDay: '2026-08-09',
      }),
    ]);

    const titles = Array.from(element.querySelectorAll('a')).map((a) => a.textContent ?? '');
    const cardTitles = titles.filter((t) => /Termin|Ferienwoche/.test(t));
    expect(cardTitles[0]).toContain('Ferienwoche');
    expect(cardTitles[1]).toContain('Erster Termin');
    expect(cardTitles[2]).toContain('Zweiter Termin');
  });

  it('shows the empty state when the day has no occurrences', async () => {
    const { element } = await setup('2026-08-05', []);

    expect(element.textContent).toContain('Keine Termine an diesem Tag.');
  });

  it('explains that every source is hidden instead of the plain empty state', async () => {
    const { element } = await setup('2026-08-05', [], true);

    expect(element.textContent).toContain('Alle Kalender ausgeblendet');
    expect(element.textContent).not.toContain('Keine Termine an diesem Tag.');
  });

  it('prefers the sources-hidden explanation even when occurrences would otherwise show', async () => {
    const { element } = await setup('2026-08-05', [occurrence()], true);

    expect(element.textContent).toContain('Alle Kalender ausgeblendet');
    expect(element.textContent).not.toContain('Workshop');
  });

  it('announces the day and its appointment count through a status region', async () => {
    const { element } = await setup('2026-08-05', [occurrence()]);

    const status = element.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('Mittwoch, 5. August 2026');
    expect(status?.textContent).toContain('1 Termin');
  });

  it("carries the calendar's view into every link, so returning lands on the same view", async () => {
    const { element } = await setup('2026-08-05', [occurrence()], false, 'month');

    const links = Array.from(element.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual([
      '/calendar/event/occ-1?view=month',
      '/calendar/event/new?day=2026-08-05&view=month',
    ]);
  });

  it('keeps „Neuer Termin" at the end of the list', async () => {
    const { element } = await setup('2026-08-05', [occurrence()]);

    const links = Array.from(element.querySelectorAll('a'));
    const last = links[links.length - 1];
    expect(last.textContent).toContain('Neuer Termin');
    expect(last.getAttribute('href')).toBe('/calendar/event/new?day=2026-08-05');
  });
});
