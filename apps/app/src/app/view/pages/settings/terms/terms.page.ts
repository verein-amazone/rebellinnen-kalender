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
import { valueOr } from '@app/cross-cutting/helpers/resource-value';

/**
 * "Nutzungsbedingungen" (#79): the app's terms of use. The text is `nutzungsbedingungen.md` in
 * `@amazone/legal` (packages/legal), bundled with the app so it reads offline and published on the
 * website next to the privacy policy.
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

  protected readonly markdown = computed(() => valueOr(this.data, null));
}
