import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { MainNavigationScaffold } from './main-navigation.scaffold';

@Component({ template: 'stub' })
class StubPage {}

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

    const harness = TestBed.createComponent(MainNavigationScaffold);
    await TestBed.inject(Router).navigateByUrl(url);
    await harness.whenStable();

    return harness.nativeElement as HTMLElement;
  }

  it('should show the bottom navigation on a primary destination', async () => {
    const element = await setUp('/today');

    expect(element.querySelector('nav')).toBeTruthy();
    expect(element.querySelectorAll('nav a').length).toBe(3);
  });

  it('should mark the active destination programmatically', async () => {
    const element = await setUp('/calendar');

    const current = element.querySelector('nav a[aria-current="page"]');
    expect(current?.textContent).toContain('Kalender');
  });

  it('should hide the bottom navigation on a focused screen', async () => {
    const element = await setUp('/calendar/event/new');

    expect(element.querySelector('nav')).toBeNull();
  });
});
