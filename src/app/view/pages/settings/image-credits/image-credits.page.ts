import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';

import { LegalContentInteractor } from '@app/interactors/settings/legal-content.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';

/**
 * The image catalog records each change in English, as the licences' own wording expects; the
 * screen says it in German. A change without an entry here is shown as recorded.
 */
const CHANGE_LABELS: Readonly<Record<string, string>> = {
  resized: 'verkleinert',
  cropped: 'zugeschnitten',
  'converted to WebP': 'in WebP umgewandelt',
};

/**
 * "Bildnachweise" (#11): every image bundled with the app, with its full attribution - creator,
 * licence, source and changes - from the image catalog `public/content/images.json` (see
 * `public/content/README.md`). The content screens only show creator and licence under a picture;
 * this is where the rest is. Loaded as a local asset, so this works offline; the source and licence
 * links only resolve while a connection is available.
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

  protected readonly items = computed(() =>
    valueOr(this.data, []).map((item) => ({
      ...item,
      changesLabel: item.changes.map((change) => CHANGE_LABELS[change] ?? change).join(', '),
    })),
  );
}
