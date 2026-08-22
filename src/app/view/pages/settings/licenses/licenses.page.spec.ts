import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';

import { LicensesPage } from './licenses.page';

class FakeLegalContentInteractor {
  text: string | null = 'Package X — MIT';

  thirdPartyLicenses(): Promise<string | null> {
    return Promise.resolve(this.text);
  }
}

async function setup(config: { text?: string | null } = {}) {
  const legalContent = new FakeLegalContentInteractor();
  legalContent.text = config.text === undefined ? legalContent.text : config.text;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LegalContentInteractor, useValue: legalContent }],
  });

  const fixture = TestBed.createComponent(LicensesPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('LicensesPage', () => {
  it('shows the bundled third-party licence text', async () => {
    const { element } = await setup({ text: 'Package X — MIT' });

    expect(element.textContent).toContain('Package X — MIT');
  });

  it('shows a fallback when the licence file is unavailable', async () => {
    const { element } = await setup({ text: null });

    expect(element.textContent).toContain('nicht verfügbar');
  });
});
