import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CalendarAvatar } from './calendar-avatar';

@Component({
  imports: [CalendarAvatar],
  template: `<app-calendar-avatar color="#a1b2c3" emoji="🏠" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('CalendarAvatar', () => {
  it('is decorative: the circle is aria-hidden, since the calendar is always named in text nearby', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const circle = element.querySelector('[aria-hidden="true"]');
    expect(circle).not.toBeNull();
    expect(circle?.textContent?.trim()).toBe('🏠');
  });

  it('uses the given colour as the background', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const circle = element.querySelector<HTMLElement>('[aria-hidden="true"]');
    expect(circle?.style.backgroundColor).toBe('rgb(161, 178, 195)');
  });
});
