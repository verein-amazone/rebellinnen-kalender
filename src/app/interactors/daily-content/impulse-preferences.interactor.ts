import { computed, inject, Injectable } from '@angular/core';

import type { ImpulseGreetingId } from '@app/data/stores/impulse-preferences';
import { ImpulsePreferencesStore } from '@app/data/stores/impulse-preferences.store';
import type { ChoiceOption } from '@app/interactors/choice-option';

export type { ImpulseGreetingId };

/**
 * Reading and changing how the Tagesimpuls behaves on the Today page.
 *
 * The interactor owns the option list including its German labels, so the wording is the same
 * wherever the choice appears - its own settings page and the overview row's value.
 */
@Injectable({ providedIn: 'root' })
export class ImpulsePreferencesInteractor {
  private readonly store = inject(ImpulsePreferencesStore);

  readonly greeting = computed(() => this.store.preferences().greeting);

  readonly greetingOptions: readonly ChoiceOption<ImpulseGreetingId>[] = [
    {
      id: 'every-open',
      label: 'Bei jedem Öffnen',
      description: 'Der Tagesimpuls wackelt kurz, sobald du die App öffnest.',
    },
    {
      id: 'daily',
      label: 'Einmal am Tag',
      description: 'Der Tagesimpuls wackelt nur, wenn du die App zum ersten Mal am Tag öffnest.',
    },
    {
      // „Ohne Animation“, not „Ohne Begrüßung“: it names what is left out, which is the wording
      // testers asked for.
      id: 'off',
      label: 'Ohne Animation',
      description: 'Der Tagesimpuls erscheint ruhig, ohne sich zu bewegen.',
    },
  ];

  readonly greetingLabel = computed(
    () => this.greetingOptions.find((option) => option.id === this.greeting())?.label ?? '',
  );

  selectGreeting(greeting: ImpulseGreetingId): void {
    this.store.update({ greeting });
  }
}
