import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import {
  type CompletedVisibilityId,
  ReminderPreferencesInteractor,
  type ReminderPlacementId,
} from '@app/interactors/reminders/reminder-preferences.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-reminders',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './reminders.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsRemindersPage {
  protected readonly preferences = inject(ReminderPreferencesInteractor);
  private readonly haptics = inject(HapticsInteractor);

  protected selectNewItemPlacement(placement: ReminderPlacementId): void {
    this.preferences.selectNewItemPlacement(placement);
    void this.haptics.selection();
  }

  protected selectCompletedVisibility(visibility: CompletedVisibilityId): void {
    this.preferences.selectCompletedVisibility(visibility);
    void this.haptics.selection();
  }
}
