import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * "Datenschutz" (#79): the app's own privacy policy, bundled as `public/legal/datenschutz.md` so it
 * reads offline. The same file is published as a static page for the store listings
 * (`scripts/build-privacy-page.mjs`), so the app and the stores always show the same text.
 */
@Component({
  selector: 'app-settings-privacy',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, MarkdownContentComponent],
  templateUrl: './privacy.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPage {
  private readonly legalContent = inject(LegalContentInteractor);

  private readonly data = resource({ loader: () => this.legalContent.privacyPolicy() });

  protected readonly markdown = computed(() => this.data.value() ?? null);
}
