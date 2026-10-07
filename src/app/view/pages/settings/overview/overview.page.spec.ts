import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DEVELOPER_TOOLS_ENABLED } from '@app/cross-cutting/infrastructure/developer-tools';

import { SettingsOverviewPage } from './overview.page';

async function setup(developerToolsEnabled: boolean): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DEVELOPER_TOOLS_ENABLED, useValue: developerToolsEnabled },
    ],
  });

  const fixture = TestBed.createComponent(SettingsOverviewPage);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
}

function linkTargets(element: HTMLElement): (string | null)[] {
  return Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href'));
}

describe('SettingsOverviewPage', () => {
  it('offers the developer tools in a prerelease build', async () => {
    const element = await setup(true);

    expect(element.textContent).toContain('Entwicklung');
    expect(linkTargets(element)).toEqual(
      expect.arrayContaining(['/settings/content-catalog', '/settings/dev-tools']),
    );
  });

  it('hides the developer tools in a store build', async () => {
    const element = await setup(false);

    expect(element.textContent).not.toContain('Entwicklung');
    expect(linkTargets(element)).not.toContain('/settings/content-catalog');
    expect(linkTargets(element)).not.toContain('/settings/dev-tools');
  });
});
