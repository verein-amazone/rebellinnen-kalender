import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { APP_VERSION } from '@app/cross-cutting/infrastructure/app-version';

import { AboutPage } from './about.page';

async function setup(): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });

  const fixture = TestBed.createComponent(AboutPage);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
}

describe('AboutPage', () => {
  it('breaks the page into scannable sections rather than one block of prose', async () => {
    const element = await setup();

    const headings = Array.from(element.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(['Deine Daten bleiben bei dir', 'Wer dahintersteckt', 'Nachweise']);
  });

  it('opens every partner link externally, naming where it goes', async () => {
    const element = await setup();

    const externalLinks = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[target]'));
    expect(externalLinks.map((link) => link.getAttribute('href'))).toEqual([
      'https://www.amazone.or.at/',
      'https://www.amazone.or.at/projekte/rebell-innen-kalender',
      'https://independo.app/',
    ]);
    for (const link of externalLinks) {
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      // Voice Control users say what they see, so the name starts with the visible label.
      expect(link.getAttribute('aria-label')).toContain(link.textContent?.trim());
    }
  });

  it('keeps the credits reachable, since they left the settings list', async () => {
    const element = await setup();

    const routerLinks = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href^="/"]'));
    expect(routerLinks.map((link) => link.getAttribute('href'))).toContain('/settings/licenses');
    expect(routerLinks.map((link) => link.getAttribute('href'))).toContain(
      '/settings/image-credits',
    );
  });

  it('states the running version', async () => {
    const element = await setup();

    expect(element.textContent).toContain(`Version ${APP_VERSION}`);
  });
});
