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
 * "Datenschutz" (#79): the app's own privacy policy, bundled as `public/legal/datenschutz.md` so it
 * reads offline. The same file is published as a static page for the store listings
 * (`scripts/build-legal-pages.mjs`), so the app and the stores always show the same text.
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

  /**
   * Optional `?returnTo=`: the introduction links here and has to be returned to, not the
   * settings. Bound by the router's component input binding.
   */
  readonly returnTo = input<string | null>(null);

  /** `null` unless the caller passed a route of this app - see `safeInAppUrl`. */
  protected readonly safeReturnTo = computed(() => safeInAppUrl(this.returnTo()));

  private readonly data = resource({ loader: () => this.legalContent.privacyPolicy() });

  protected readonly markdown = computed(() => valueOr(this.data, null));
}
