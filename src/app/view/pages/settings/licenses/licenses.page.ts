import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * "Open-Source-Lizenzen" (#11): the third-party licence file Angular's `extractLicenses` build
 * option generates for production builds (`angular.json`), read from the bundled app so it works
 * fully offline. In development builds the file doesn't exist, hence the fallback text.
 */
@Component({
  selector: 'app-settings-licenses',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './licenses.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicensesPage {
  private readonly legalContent = inject(LegalContentInteractor);

  private readonly data = resource({ loader: () => this.legalContent.thirdPartyLicenses() });

  protected readonly text = computed(() => this.data.value() ?? null);
}
