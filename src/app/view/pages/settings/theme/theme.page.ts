import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  AppearanceInteractor,
  type ThemeId,
} from '@app/interactors/settings/appearance.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-theme',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './theme.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemePage {
  protected readonly appearance = inject(AppearanceInteractor);

  protected select(theme: ThemeId): void {
    this.appearance.selectTheme(theme);
  }
}
