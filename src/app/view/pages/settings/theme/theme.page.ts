import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import {
  AppearanceInteractor,
  type ThemeId,
} from '@app/interactors/settings/appearance.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-theme',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './theme.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePage {
  protected readonly appearance = inject(AppearanceInteractor);
  private readonly haptics = inject(HapticsInteractor);

  protected select(theme: ThemeId): void {
    this.appearance.selectTheme(theme);
    void this.haptics.selection();
  }
}
