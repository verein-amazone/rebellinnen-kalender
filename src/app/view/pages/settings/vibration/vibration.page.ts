import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  AppearanceInteractor,
  type VibrationId,
} from '@app/interactors/settings/appearance.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-vibration',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './vibration.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VibrationPage {
  protected readonly appearance = inject(AppearanceInteractor);

  protected select(vibration: VibrationId): void {
    this.appearance.selectVibration(vibration);
  }
}
