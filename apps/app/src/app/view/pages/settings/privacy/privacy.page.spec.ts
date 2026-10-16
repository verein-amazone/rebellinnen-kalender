import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';

import { PrivacyPage } from './privacy.page';

class FakeLegalContentInteractor {
  markdown: string | null = '## Verantwortliche Stelle\n\nVerein Amazone';

  privacyPolicy(): Promise<string | null> {
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

  const fixture = TestBed.createComponent(PrivacyPage);
  await fixture.whenStable();

  return { element: fixture.nativeElement as HTMLElement };
}

describe('PrivacyPage', () => {
  it('renders the bundled privacy policy as Markdown', async () => {
    const { element } = await setup({ markdown: '## Verantwortliche Stelle\n\nVerein Amazone' });

    expect(element.querySelector('h2')?.textContent).toBe('Verantwortliche Stelle');
    expect(element.textContent).toContain('Verein Amazone');
  });

  it('shows a fallback when the privacy policy is unavailable', async () => {
    const { element } = await setup({ markdown: null });

    expect(element.textContent).toContain('nicht verfügbar');
  });
});
