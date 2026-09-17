import { LiveAnnouncer } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import {
  CalendarFiltersInteractor,
  type CalendarFilterOption,
} from '@app/interactors/calendar/calendar-filters.interactor';

import { CalendarOrderPage } from './calendar-order.page';

class FakeCalendarFiltersInteractor {
  calendars: CalendarFilterOption[] = [];
  readonly moves: { calendarId: string; toIndex: number }[] = [];

  listFilterable(): Promise<CalendarFilterOption[]> {
    return Promise.resolve(this.calendars);
  }

  move(calendarId: string, toIndex: number): Promise<void> {
    this.moves.push({ calendarId, toIndex });
    return Promise.resolve();
  }
}

class StubLiveAnnouncer {
  readonly announcements: string[] = [];

  announce(message: string): Promise<void> {
    this.announcements.push(message);
    return Promise.resolve();
  }
}

function calendar(id: string, name: string): CalendarFilterOption {
  return { id, name, color: null, emoji: null };
}

async function setup(calendars: CalendarFilterOption[]) {
  const filters = new FakeCalendarFiltersInteractor();
  filters.calendars = calendars;
  const announcer = new StubLiveAnnouncer();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CalendarFiltersInteractor, useValue: filters },
      { provide: LiveAnnouncer, useValue: announcer },
    ],
  });

  const fixture = TestBed.createComponent(CalendarOrderPage);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    filters,
    announcer,
    settle: () => fixture.whenStable(),
    names: () =>
      Array.from(element.querySelectorAll('[data-testid="calendar-name"]')).map((row) =>
        row.textContent?.trim(),
      ),
    /** Opens a row's menu and picks one of its entries. */
    async chooseAction(name: string, action: 'Nach oben' | 'Nach unten') {
      const rows = Array.from(element.querySelectorAll('li'));
      const row = rows.find((candidate) => candidate.textContent?.includes(name))!;
      row.querySelector<HTMLButtonElement>('button.rk-icon-button')!.click();
      await fixture.whenStable();

      const items = Array.from(row.querySelectorAll<HTMLButtonElement>('.rk-menu-item'));
      items.find((item) => item.textContent?.includes(action))!.click();
      await fixture.whenStable();
    },
  };
}

describe('CalendarOrderPage', () => {
  it('lists the calendars in the order the chips use', async () => {
    const page = await setup([calendar('cal-1', 'Mein Kalender'), calendar('cal-2', 'Arbeit')]);

    expect(page.names()).toEqual(['Mein Kalender', 'Arbeit']);
  });

  it('offers no move where it would do nothing', async () => {
    const page = await setup([calendar('cal-1', 'Mein Kalender'), calendar('cal-2', 'Arbeit')]);

    const rows = Array.from(page.element.querySelectorAll('li'));
    rows[0].querySelector<HTMLButtonElement>('button.rk-icon-button')!.click();
    await page.settle();

    expect(rows[0].textContent).not.toContain('Nach oben');
    expect(rows[0].textContent).toContain('Nach unten');
  });

  it('moves a calendar down, shows the new order right away and announces it once', async () => {
    const page = await setup([calendar('cal-1', 'Mein Kalender'), calendar('cal-2', 'Arbeit')]);

    await page.chooseAction('Mein Kalender', 'Nach unten');

    expect(page.filters.moves).toEqual([{ calendarId: 'cal-1', toIndex: 1 }]);
    expect(page.names()).toEqual(['Arbeit', 'Mein Kalender']);
    expect(page.announcer.announcements).toEqual(['„Mein Kalender“ ist jetzt an Position 2 von 2']);
  });

  it('keeps the drag handle out of the tab order, since the menu carries the same moves', async () => {
    const page = await setup([calendar('cal-1', 'Mein Kalender'), calendar('cal-2', 'Arbeit')]);

    const handle = page.element.querySelector('.rk-drag-handle');
    expect(handle?.getAttribute('aria-hidden')).toBe('true');
    expect(handle?.hasAttribute('tabindex')).toBe(false);
  });

  it('explains itself instead of showing an empty list when there is no calendar yet', async () => {
    const page = await setup([]);

    expect(page.element.querySelector('li')).toBeNull();
    expect(page.element.textContent).toContain('noch keine Kalender');
  });

  it('offers no reordering for a single calendar', async () => {
    const page = await setup([calendar('cal-1', 'Mein Kalender')]);

    expect(page.element.querySelector('li button.rk-icon-button')).toBeNull();
  });
});
