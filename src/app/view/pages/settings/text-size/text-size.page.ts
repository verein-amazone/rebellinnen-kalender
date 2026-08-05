import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  AppearanceInteractor,
  type TextSizeId,
} from '@app/interactors/settings/appearance.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-text-size',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './text-size.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextSizePage {
  protected readonly appearance = inject(AppearanceInteractor);

  protected select(textSize: TextSizeId): void {
    this.appearance.selectTextSize(textSize);
  }
}
