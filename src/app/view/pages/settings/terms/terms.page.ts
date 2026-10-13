import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
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

  /**
   * Optional `?returnTo=`: the introduction links here and has to be returned to, not the
   * settings. Bound by the router's component input binding.
   */
  readonly returnTo = input<string | null>(null);

  /** `null` unless the caller passed a route of this app - see `safeInAppUrl`. */
  protected readonly safeReturnTo = computed(() => safeInAppUrl(this.returnTo()));

  private readonly data = resource({ loader: () => this.legalContent.termsOfUse() });

  protected readonly markdown = computed(() => this.data.value() ?? null);
}
