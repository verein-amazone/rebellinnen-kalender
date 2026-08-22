import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * "Bildnachweise" (#11): every image bundled with the app, credited from
 * `public/image-attributions.json` — the central attribution data source (see that file's
 * neighbouring `public/content/README.md`). Loaded as a local asset, so this works offline; the
 * source and licence links only resolve while a connection is available.
 */
@Component({
  selector: 'app-settings-image-credits',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './image-credits.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageCreditsPage {
  private readonly legalContent = inject(LegalContentInteractor);

  private readonly data = resource({ loader: () => this.legalContent.imageAttributions() });

  protected readonly items = computed(() => this.data.value() ?? []);
}
