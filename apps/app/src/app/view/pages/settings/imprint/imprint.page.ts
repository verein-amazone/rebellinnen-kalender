import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { MarkdownContentComponent } from '@app/view/components/markdown-content/markdown-content';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';

/**
 * "Impressum": Verein Amazone's imprint for the app. The text is `impressum.md` in `@amazone/legal`
 * (packages/legal), bundled with the app so it reads offline and published on the website next to
 * the privacy policy and the terms of use. It used to be a link to the Amazone website, whose
 * imprint does not name the app.
 */
@Component({
  selector: 'app-settings-imprint',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, MarkdownContentComponent],
  templateUrl: './imprint.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImprintPage {
  private readonly legalContent = inject(LegalContentInteractor);

  private readonly data = resource({ loader: () => this.legalContent.imprint() });

  protected readonly markdown = computed(() => valueOr(this.data, null));
}
