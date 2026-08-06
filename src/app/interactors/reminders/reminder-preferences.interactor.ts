import { computed, inject, Injectable } from '@angular/core';

import type { ReminderPlacementId } from '@app/data/stores/reminder-preferences';
import { RemindersStore } from '@app/data/stores/reminders.store';
import type { ChoiceOption } from '@app/interactors/choice-option';

export type { ReminderPlacementId };

/**
 * How completed entries are treated once their day is over. Two ids rather than a boolean, so the
 * settings screen can render them the same way as every other choice.
 */
export type CompletedVisibilityId = 'hide' | 'keep';

/**
 * Reading and changing the preferences of the „Nicht vergessen“ list.
 *
 * These only decide where an entry enters a section and how long a completed one stays visible — the
 * order itself belongs to the user and lives with the entries. The interactor owns the option lists
 * including their German labels, so the wording is the same wherever the choices appear.
 */
@Injectable({ providedIn: 'root' })
export class ReminderPreferencesInteractor {
  private readonly store = inject(RemindersStore);

  readonly newItemPlacement = computed(() => this.store.preferences().newItemPlacement);
  readonly completedItemPlacement = computed(() => this.store.preferences().completedItemPlacement);
  readonly completedVisibility = computed<CompletedVisibilityId>(() =>
    this.store.preferences().hideCompletedAtDayChange ? 'hide' : 'keep',
  );

  readonly newItemPlacementOptions: readonly ChoiceOption<ReminderPlacementId>[] = [
    { id: 'top', label: 'Oben', description: 'Neue Punkte stehen ganz oben in der Liste.' },
    { id: 'bottom', label: 'Unten', description: 'Neue Punkte stehen am Ende der Liste.' },
  ];

  readonly completedItemPlacementOptions: readonly ChoiceOption<ReminderPlacementId>[] = [
    {
      id: 'top',
      label: 'Oben',
      description: 'Zuletzt erledigte Punkte stehen oben bei den erledigten.',
    },
    {
      id: 'bottom',
      label: 'Unten',
      description: 'Zuletzt erledigte Punkte stehen unten bei den erledigten.',
    },
  ];

  readonly completedVisibilityOptions: readonly ChoiceOption<CompletedVisibilityId>[] = [
    {
      id: 'hide',
      label: 'Ausblenden',
      description: 'Erledigte Punkte verschwinden am nächsten Tag. Gelöscht werden sie nicht.',
    },
    {
      id: 'keep',
      label: 'Sichtbar lassen',
      description: 'Erledigte Punkte bleiben in der Liste stehen.',
    },
  ];

  selectNewItemPlacement(newItemPlacement: ReminderPlacementId): void {
    this.store.update({ newItemPlacement });
  }

  selectCompletedItemPlacement(completedItemPlacement: ReminderPlacementId): void {
    this.store.update({ completedItemPlacement });
  }

  selectCompletedVisibility(visibility: CompletedVisibilityId): void {
    this.store.update({ hideCompletedAtDayChange: visibility === 'hide' });
  }
}
