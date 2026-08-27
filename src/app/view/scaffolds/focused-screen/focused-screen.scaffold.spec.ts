import { Component, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { FocusedScreenScaffold } from './focused-screen.scaffold';

@Component({ template: '<h1>Stub</h1>' })
class StubPage {}

@Component({
  imports: [FocusedScreenScaffold],
  template: `
    <app-focused-screen heading="Termin" [returnTo]="returnTo()" [beforeDismiss]="beforeDismiss()">
      <button header-actions type="button">Kopfzeilen-Aktion</button>
      @if (withFooter()) {
        <button footer #focusedScreenFooter type="button">Fußzeilen-Aktion</button>
      }
      <p>Inhalt</p>
    </app-focused-screen>
  `,
})
class HostPage {
  readonly withFooter = signal(false);
  readonly returnTo = signal<string | null>(null);
  readonly beforeDismiss = signal<(() => boolean) | undefined>(undefined);
}

describe('FocusedScreenScaffold', () => {
  async function setUp(...urls: readonly string[]) {
    await TestBed.configureTestingModule({
      imports: [HostPage],
      providers: [
        provideRouter([
          { path: 'today', component: StubPage },
          { path: 'detail', component: HostPage },
        ]),
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    for (const url of urls.length > 0 ? urls : ['/detail']) {
      await router.navigateByUrl(url);
    }

    const fixture = TestBed.createComponent(HostPage);
    await fixture.whenStable();

    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('projects header actions into the header bar', async () => {
    const { element } = await setUp();

    const header = element.querySelector('header');
    expect(header?.textContent).toContain('Kopfzeilen-Aktion');
  });

  it('renders no footer chrome when nothing is projected into it', async () => {
    const { element } = await setUp();

    expect(element.textContent).not.toContain('Fußzeilen-Aktion');
    expect(element.querySelectorAll('header').length).toBe(1);
    // Only the header's own border/background chrome should exist - no second sticky bar.
    expect(element.querySelectorAll('.sticky').length).toBe(1);
  });

  it('renders a sticky footer bar when content is projected into it', async () => {
    const { fixture, element } = await setUp();
    fixture.componentInstance.withFooter.set(true);
    await fixture.whenStable();

    expect(element.textContent).toContain('Fußzeilen-Aktion');
    expect(element.querySelectorAll('.sticky').length).toBe(2);
  });

  it('lets beforeDismiss intercept the back arrow instead of navigating away', async () => {
    const { fixture, element } = await setUp();
    let intercepted = false;
    fixture.componentInstance.beforeDismiss.set(() => {
      intercepted = true;
      return true;
    });
    await fixture.whenStable();

    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const backSpy = vi.spyOn(TestBed.inject(Location), 'back');

    element.querySelector<HTMLButtonElement>('header button')!.click();
    await fixture.whenStable();

    expect(intercepted).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('falls back to the default dismiss navigation when beforeDismiss returns false', async () => {
    const { fixture, element } = await setUp();
    fixture.componentInstance.beforeDismiss.set(() => false);
    await fixture.whenStable();

    const navigateByUrlSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    dismiss(element);
    await fixture.whenStable();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/today', { replaceUrl: true });
  });

  it('dismisses to the fallback link instead of walking the history back', async () => {
    // Two navigations, so `lastSuccessfulNavigation()?.previousNavigation` is set: the scaffold
    // used to prefer `location.back()` here, which is exactly what produced the back-button loop.
    const { fixture, element } = await setUp('/today', '/detail');

    const navigateByUrlSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const backSpy = vi.spyOn(TestBed.inject(Location), 'back');

    dismiss(element);
    await fixture.whenStable();

    expect(backSpy).not.toHaveBeenCalled();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/today', { replaceUrl: true });
  });

  it('dismisses to returnTo when the caller supplied one', async () => {
    const { fixture, element } = await setUp();
    fixture.componentInstance.returnTo.set('/settings/content-catalog');
    await fixture.whenStable();

    const navigateByUrlSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    dismiss(element);
    await fixture.whenStable();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/settings/content-catalog', {
      replaceUrl: true,
    });
  });
});

/**
 * Clicks the scaffold's own dismiss button, not the projected header action - it is identified by
 * its fixed position as the header's first `.rk-icon-button`.
 */
function dismiss(element: HTMLElement): void {
  element.querySelector<HTMLButtonElement>('header .rk-icon-button')!.click();
}
