import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { CalendarFilterOption } from '@app/interactors/calendar/calendar-filters.interactor';

import { CalendarSourceFilterBlock } from './calendar-source-filter.block';

function calendar(overrides: Partial<CalendarFilterOption> = {}): CalendarFilterOption {
  return {
    id: 'calendar-1',
    name: 'Mein Kalender',
    color: '#7B3FA8',
    emoji: '📅',
    ...overrides,
  };
}

@Component({
  imports: [CalendarSourceFilterBlock],
  template: `
    <app-calendar-source-filter
      [calendars]="calendars()"
      [hiddenIds]="hiddenIds()"
      (toggled)="toggledIds.push($event)"
    />
  `,
})
class Host {
  readonly calendars = input.required<readonly CalendarFilterOption[]>();
  readonly hiddenIds = input.required<ReadonlySet<string>>();
  readonly toggledIds: string[] = [];
}

async function setup(
  calendars: readonly CalendarFilterOption[],
  hiddenIds: ReadonlySet<string> = new Set(),
): Promise<{ element: HTMLElement; host: Host }> {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(Host);
  fixture.componentRef.setInput('calendars', calendars);
  fixture.componentRef.setInput('hiddenIds', hiddenIds);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
}

describe('CalendarSourceFilterBlock', () => {
  it('renders one toggle button per calendar, naming it and showing its emoji', async () => {
    const { element } = await setup([
      calendar({ id: 'a', name: 'Mein Kalender', emoji: '📅' }),
      calendar({ id: 'b', name: 'Rebell*innen Kalender', emoji: '✊' }),
    ]);

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('Mein Kalender');
    expect(buttons[0].textContent).toContain('📅');
    expect(buttons[1].textContent).toContain('Rebell*innen Kalender');
  });

  it('marks a visible calendar as pressed and a hidden one as not pressed', async () => {
    const { element } = await setup([calendar({ id: 'a' }), calendar({ id: 'b' })], new Set(['b']));

    const buttons = Array.from(element.querySelectorAll('button'));
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the calendar id when its chip is clicked', async () => {
    const { element, host } = await setup([calendar({ id: 'a' })]);

    element.querySelector('button')?.click();

    expect(host.toggledIds).toEqual(['a']);
  });

  it('carries the calendar colour as the pill colour when visible', async () => {
    const { element } = await setup([calendar({ id: 'a', color: '#E92F2A' })]);

    const button = element.querySelector<HTMLButtonElement>('button');
    expect(button?.classList).toContain('rk-pill');
    expect(button?.style.getPropertyValue('--pill-color')).toBe('#E92F2A');
  });

  it('drops the pill colour when hidden, so the muted default applies', async () => {
    const { element } = await setup([calendar({ id: 'a', color: '#E92F2A' })], new Set(['a']));

    const button = element.querySelector<HTMLButtonElement>('button');
    expect(button?.style.getPropertyValue('--pill-color')).toBe('');
  });
});
