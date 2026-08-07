import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CalendarGridBlock, type DayMarker } from './calendar-grid.block';

@Component({
  imports: [CalendarGridBlock],
  template: `
    <app-calendar-grid
      [view]="view()"
      [selectedDay]="selectedDay()"
      [today]="today()"
      [markersByDay]="markersByDay()"
      (daySelected)="selected.set($event)"
    />
  `,
})
class Host {
  readonly view = input.required<'week' | 'month'>();
  readonly selectedDay = input.required<string>();
  readonly today = input.required<string>();
  readonly markersByDay = input<ReadonlyMap<string, DayMarker>>(new Map());
  readonly selected = signal<string | null>(null);
}

interface Setup {
  readonly element: HTMLElement;
  readonly host: Host;
  readonly buttons: () => HTMLButtonElement[];
  readonly press: (key: string) => Promise<void>;
}

async function setup(inputs: {
  view: 'week' | 'month';
  selectedDay: string;
  today?: string;
  markersByDay?: ReadonlyMap<string, DayMarker>;
}): Promise<Setup> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('view', inputs.view);
  fixture.componentRef.setInput('selectedDay', inputs.selectedDay);
  fixture.componentRef.setInput('today', inputs.today ?? '2026-08-07');
  fixture.componentRef.setInput('markersByDay', inputs.markersByDay ?? new Map());
  await fixture.whenStable();

  const element = fixture.nativeElement as HTMLElement;

  return {
    element,
    host: fixture.componentInstance,
    buttons: () => Array.from(element.querySelectorAll('button')),
    press: async (key) => {
      element
        .querySelector('button[tabindex="0"]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
    },
  };
}

describe('CalendarGridBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('renders the seven days of the selected week, Monday first', async () => {
    const { buttons } = await setup({ view: 'week', selectedDay: '2026-08-05' });

    expect(buttons()).toHaveLength(7);
    expect(buttons()[0].textContent).toContain('3');
    expect(buttons()[0].textContent).toContain('Montag, 3. August 2026');
    expect(buttons()[6].textContent).toContain('Sonntag, 9. August 2026');
  });

  it('renders the full month grid including out-of-month edge days', async () => {
    const { buttons } = await setup({ view: 'month', selectedDay: '2026-08-15' });

    // August 2026 spans six Monday-to-Sunday weeks: 27 July through 6 September.
    expect(buttons()).toHaveLength(42);
    expect(buttons()[0].textContent).toContain('Montag, 27. Juli 2026');
    expect(buttons()[41].textContent).toContain('Sonntag, 6. September 2026');
  });

  it('dims out-of-month edge days in month view', async () => {
    const { buttons } = await setup({ view: 'month', selectedDay: '2026-08-15' });

    // 27 July, the grid's first cell, is outside August.
    expect(buttons()[0].querySelector('span')?.classList.contains('text-muted-foreground')).toBe(
      true,
    );
  });

  it('never dims days in week view, even across a month boundary', async () => {
    // 2026-08-01 is a Saturday; its week runs 27 July through 2 August.
    const { buttons } = await setup({ view: 'week', selectedDay: '2026-08-01' });

    for (const button of buttons()) {
      expect(button.querySelector('span')?.classList.contains('text-muted-foreground')).toBe(false);
    }
  });

  it('marks only the selected day as pressed', async () => {
    const { buttons } = await setup({ view: 'week', selectedDay: '2026-08-05' });

    const pressed = buttons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain('Mittwoch, 5. August 2026');
  });

  it('marks only today with aria-current', async () => {
    const { buttons } = await setup({
      view: 'week',
      selectedDay: '2026-08-05',
      today: '2026-08-07',
    });

    const current = buttons().filter((b) => b.getAttribute('aria-current') === 'date');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Freitag, 7. August 2026');
  });

  it('names the appointment count on days that have one', async () => {
    const markers = new Map<string, DayMarker>([
      ['2026-08-05', { colors: ['#e92f2a'], count: 2 }],
      ['2026-08-06', { colors: ['#7b3fa8'], count: 1 }],
    ]);
    const { buttons } = await setup({
      view: 'week',
      selectedDay: '2026-08-05',
      markersByDay: markers,
    });

    expect(buttons()[2].textContent).toContain('2 Termine');
    expect(buttons()[3].textContent).toContain('1 Termin');
    expect(buttons()[0].textContent).toContain('keine Termine');
  });

  it('emits the tapped day', async () => {
    const { buttons, host } = await setup({ view: 'week', selectedDay: '2026-08-05' });

    buttons()[6].click();

    expect(host.selected()).toBe('2026-08-09');
  });

  it('keeps exactly one cell in the tab order — the selected day', async () => {
    const { buttons } = await setup({ view: 'month', selectedDay: '2026-08-15' });

    const tabbable = buttons().filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].textContent).toContain('Samstag, 15. August 2026');
    expect(buttons().every((b) => b.tabIndex === 0 || b.tabIndex === -1)).toBe(true);
  });

  it('moves the roving focus by day and by week with the arrow keys', async () => {
    const { buttons, press } = await setup({ view: 'month', selectedDay: '2026-08-15' });

    await press('ArrowRight');
    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-16');
    expect(document.activeElement?.getAttribute('data-day')).toBe('2026-08-16');

    await press('ArrowDown');
    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-23');

    await press('ArrowUp');
    await press('ArrowLeft');
    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-15');

    await press('Home');
    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-10');

    await press('End');
    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-16');
  });

  it('stops the roving focus at the edge of the shown period', async () => {
    // 2026-08-09 is the Sunday ending the shown week.
    const { buttons, press } = await setup({ view: 'week', selectedDay: '2026-08-09' });

    await press('ArrowRight');

    expect(buttons().find((b) => b.tabIndex === 0)?.dataset['day']).toBe('2026-08-09');
  });

  it('shows the weekday header row in both views', async () => {
    for (const view of ['week', 'month'] as const) {
      const { element } = await setup({ view, selectedDay: '2026-08-15' });

      expect(element.textContent).toContain('Mo');
      expect(element.textContent).toContain('So');
    }
  });
});
