import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  ImpulsePreferencesInteractor,
  type ImpulseGreetingId,
} from '@app/interactors/daily-content/impulse-preferences.interactor';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * How the Tagesimpuls greets on the Today page. Its own screen rather than part of „Animationen“:
 * that one governs motion everywhere in the app, this one how a single feature behaves - and it is
 * where further Tagesimpuls choices belong.
 */
@Component({
  selector: 'app-settings-impulse',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow, RouterLink],
  templateUrl: './impulse.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpulsePage {
  protected readonly preferences = inject(ImpulsePreferencesInteractor);
  protected readonly appearance = inject(AppearanceInteractor);

  protected select(greeting: ImpulseGreetingId): void {
    this.preferences.selectGreeting(greeting);
  }
}
