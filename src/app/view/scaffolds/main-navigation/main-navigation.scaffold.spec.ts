import { Component, input, signal, type Provider } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { KeyboardVisibility } from '@app/cross-cutting/infrastructure/keyboard-visibility';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';

import { MainNavigationScaffold } from './main-navigation.scaffold';

@Component({ template: '<h1>{{ title() }}</h1><input id="stub-field" aria-label="Feld" />' })
class StubPage {
  readonly title = input('Stub');
}

describe('MainNavigationScaffold', () => {
  async function setUp(url: string, extraProviders: Provider[] = []) {
    await TestBed.configureTestingModule({
      imports: [MainNavigationScaffold],
      providers: [
        ...extraProviders,
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

  it('brings the focused field clear of the keyboard once it is announced', async () => {
    const keyboard = { visible: signal(false), inset: signal(0) };
    const { element } = await setUp('/today', [
      { provide: KeyboardVisibility, useValue: keyboard },
    ]);
    const field = element.querySelector<HTMLInputElement>('#stub-field')!;
    const scrollIntoView = vi.fn();
    field.scrollIntoView = scrollIntoView;
    field.focus();

    keyboard.visible.set(true);
    keyboard.inset.set(300);
    TestBed.tick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('leaves the scroll position alone while the keyboard is closed', async () => {
    const keyboard = { visible: signal(false), inset: signal(0) };
    const { element } = await setUp('/today', [
      { provide: KeyboardVisibility, useValue: keyboard },
    ]);
    const field = element.querySelector<HTMLInputElement>('#stub-field')!;
    const scrollIntoView = vi.fn();
    field.scrollIntoView = scrollIntoView;
    field.focus();

    keyboard.inset.set(0);
    TestBed.tick();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

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

  it('scrolls the screen back to the top when the active destination is tapped again', async () => {
    const { element } = await setUp('/calendar');
    const main = element.querySelector<HTMLElement>('main');
    const scrollTo = vi.fn();
    Object.defineProperty(main, 'scrollTo', { value: scrollTo, configurable: true });
    // jsdom would otherwise log "navigation to another Document" for the anchor's default action.
    element.addEventListener('click', (event) => event.preventDefault());

    element.querySelector<HTMLElement>('nav a[href="/calendar"]')?.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: expect.any(String) });
  });

  it('leaves the scroll position alone when another destination is tapped', async () => {
    const { element } = await setUp('/calendar');
    const main = element.querySelector<HTMLElement>('main');
    const scrollTo = vi.fn();
    Object.defineProperty(main, 'scrollTo', { value: scrollTo, configurable: true });
    // jsdom would otherwise log "navigation to another Document" for the anchor's default action.
    element.addEventListener('click', (event) => event.preventDefault());

    element.querySelector<HTMLElement>('nav a[href="/today"]')?.click();

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the query parameters on the active destination, so tapping it only scrolls', async () => {
    const { element } = await setUp('/calendar?view=month&day=2026-10-13');

    const links = Array.from(element.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));

    expect(links).toEqual(['/today', '/calendar?view=month&day=2026-10-13', '/content']);
  });

  it('scrolls without animation when the app is set to reduced motion', async () => {
    const { element } = await setUp('/calendar');
    TestBed.inject(AppearanceInteractor).selectMotion('reduced');
    const main = element.querySelector<HTMLElement>('main');
    const scrollTo = vi.fn();
    Object.defineProperty(main, 'scrollTo', { value: scrollTo, configurable: true });
    // jsdom would otherwise log "navigation to another Document" for the anchor's default action.
    element.addEventListener('click', (event) => event.preventDefault());

    element.querySelector<HTMLElement>('nav a[href="/calendar"]')?.click();

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
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
