import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';

import { ImprintPage } from './imprint.page';

class FakeLegalContentInteractor {
  markdown: string | null = '## Herausgeberin\n\nVerein Amazone';

  imprint(): Promise<string | null> {
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

  const fixture = TestBed.createComponent(ImprintPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('ImprintPage', () => {
  it('renders the bundled imprint as Markdown', async () => {
    const { element } = await setup();

    expect(element.querySelector('h1')?.textContent).toContain('Impressum');
    expect(element.querySelector('h2')?.textContent).toBe('Herausgeberin');
    expect(element.textContent).toContain('Verein Amazone');
  });

  it('shows a fallback when the imprint is unavailable', async () => {
    const { element } = await setup({ markdown: null });

    expect(element.textContent).toContain('nicht verfügbar');
  });
});
