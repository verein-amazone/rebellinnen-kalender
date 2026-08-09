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
    <app-focused-screen heading="Termin" [beforeDismiss]="beforeDismiss()">
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
  readonly beforeDismiss = signal<(() => boolean) | undefined>(undefined);
}

describe('FocusedScreenScaffold', () => {
  async function setUp(startUrl = '/detail') {
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
    await router.navigateByUrl(startUrl);

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
    // Only the header's own border/background chrome should exist — no second sticky bar.
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

    // The initial navigation to `startUrl` in `setUp` is this fixture's only navigation, so
    // `lastSuccessfulNavigation()?.previousNavigation` is null and the scaffold falls back to
    // `navigateByUrl` rather than `location.back()` — see `FocusedScreenScaffold.dismiss()`.
    const navigateByUrlSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    // The dismiss button is the scaffold's own, not the projected header action — grab it by its
    // fixed position as the header's first button.
    const dismissButton = element.querySelector<HTMLButtonElement>('header .rk-icon-button')!;
    dismissButton.click();
    await fixture.whenStable();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/today');
  });
});
