import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * "Nutzungsbedingungen" (#79): the app's terms of use, bundled as
 * `public/legal/nutzungsbedingungen.md` so they read offline and published next to the privacy
 * policy as a static page (`scripts/build-legal-pages.mjs`).
 */
@Component({
  selector: 'app-settings-terms',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, MarkdownContentComponent],
  templateUrl: './terms.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPage {
  private readonly legalContent = inject(LegalContentInteractor);

  private readonly data = resource({ loader: () => this.legalContent.termsOfUse() });

  protected readonly markdown = computed(() => this.data.value() ?? null);
}
