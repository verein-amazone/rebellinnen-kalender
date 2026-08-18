import { Component, input } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { MainNavigationScaffold } from './main-navigation.scaffold';

@Component({ template: '<h1>{{ title() }}</h1>' })
class StubPage {
  readonly title = input('Stub');
}

describe('MainNavigationScaffold', () => {
  async function setUp(url: string) {
    await TestBed.configureTestingModule({
      imports: [MainNavigationScaffold],
      providers: [
        // The scaffold under test is the fixture root, so the routes only describe its children.
        provideRouter([
          { path: 'today', component: StubPage, data: { tab: 'today' } },
          { path: 'calendar', component: StubPage, data: { tab: 'calendar' } },
          { path: 'calendar/event/new', component: StubPage },
        ]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MainNavigationScaffold);
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    await fixture.whenStable();

    async function navigateTo(target: string) {
      await router.navigateByUrl(target);
      await fixture.whenStable();
    }

    return { element: fixture.nativeElement as HTMLElement, navigateTo };
  }

  it('should show the bottom navigation on a primary destination', async () => {
    const { element } = await setUp('/today');

    expect(element.querySelector('nav')).toBeTruthy();
    expect(element.querySelectorAll('nav a').length).toBe(3);
  });

  it('should mark the active destination programmatically', async () => {
    const { element } = await setUp('/calendar');

    const current = element.querySelector('nav a[aria-current="page"]');
    expect(current?.textContent).toContain('Kalender');
  });

  it('should hide the bottom navigation on a focused screen', async () => {
    const { element } = await setUp('/calendar/event/new');

    expect(element.querySelector('nav')).toBeNull();
  });

  it('should focus the page heading when a focused screen opens', async () => {
    const { element, navigateTo } = await setUp('/calendar');

    await navigateTo('/calendar/event/new');

    expect(document.activeElement).toBe(element.querySelector('main h1'));
  });

  it('should focus the page heading when a focused screen closes', async () => {
    const { element, navigateTo } = await setUp('/calendar/event/new');

    await navigateTo('/calendar');

    expect(document.activeElement).toBe(element.querySelector('main h1'));
  });

  it('keeps the shell’s safe-top inset for a primary destination with no header of its own', async () => {
    const { element } = await setUp('/today');

    expect(element.querySelector('main')?.classList).toContain('safe-top');
  });

  it('leaves the safe-top inset to the calendar tab’s own sticky header instead of doubling it', async () => {
    const { element } = await setUp('/calendar');

    expect(element.querySelector('main')?.classList).not.toContain('safe-top');
  });

  it('should announce rather than steal focus when switching primary destinations', async () => {
    const { element, navigateTo } = await setUp('/today');
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce');

    const link = element.querySelector<HTMLElement>('nav a[href="/calendar"]');
    link?.focus();
    await navigateTo('/calendar');

    expect(document.activeElement).toBe(link);
    expect(announce).toHaveBeenCalledWith('Stub', 'polite');
  });
});
