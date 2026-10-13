import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';

import { TermsPage } from './terms.page';

class FakeLegalContentInteractor {
  markdown: string | null = '## 1. Über den Rebell*innen Kalender\n\nVerein Amazone';

  termsOfUse(): Promise<string | null> {
    return Promise.resolve(this.markdown);
  }
}

async function setup(config: { markdown?: string | null } = {}) {
  const legalContent = new FakeLegalContentInteractor();
  legalContent.markdown = config.markdown === undefined ? legalContent.markdown : config.markdown;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: LegalContentInteractor, useValue: legalContent }],
  });

  const fixture = TestBed.createComponent(TermsPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('TermsPage', () => {
  it('renders the bundled terms of use as Markdown', async () => {
    const { element } = await setup({
      markdown: '## 1. Über den Rebell*innen Kalender\n\nVerein Amazone',
    });

    expect(element.querySelector('h2')?.textContent).toBe('1. Über den Rebell*innen Kalender');
    expect(element.textContent).toContain('Verein Amazone');
  });

  it('shows a fallback when the terms of use are unavailable', async () => {
    const { element } = await setup({ markdown: null });

    expect(element.textContent).toContain('nicht verfügbar');
  });
});
