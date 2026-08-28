import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  AppearanceInteractor,
  type ImpulseGreetingId,
  type MotionId,
} from '@app/interactors/settings/appearance.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-motion',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './motion.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MotionPage {
  protected readonly appearance = inject(AppearanceInteractor);

  protected select(motion: MotionId): void {
    this.appearance.selectMotion(motion);
  }

  protected selectGreeting(greeting: ImpulseGreetingId): void {
    this.appearance.selectImpulseGreeting(greeting);
  }
}
