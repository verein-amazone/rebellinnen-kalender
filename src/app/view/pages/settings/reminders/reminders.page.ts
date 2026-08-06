import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

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

  protected selectNewItemPlacement(placement: ReminderPlacementId): void {
    this.preferences.selectNewItemPlacement(placement);
  }

  protected selectCompletedItemPlacement(placement: ReminderPlacementId): void {
    this.preferences.selectCompletedItemPlacement(placement);
  }

  protected selectCompletedVisibility(visibility: CompletedVisibilityId): void {
    this.preferences.selectCompletedVisibility(visibility);
  }
}
