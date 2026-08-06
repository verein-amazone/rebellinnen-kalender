import { computed, inject, Injectable } from '@angular/core';

import { AppearanceStore } from '@app/data/stores/appearance.store';
import type { MotionId, TextSizeId, ThemeId } from '@app/data/stores/appearance-preferences';
import type { ChoiceOption } from '@app/interactors/choice-option';

export type { MotionId, TextSizeId, ThemeId };

/** A selectable appearance option. The shape is shared with the other settings screens. */
export type AppearanceOption<TId extends string> = ChoiceOption<TId>;

/**
 * Reading and changing the appearance preferences: colour theme, text size and motion.
 *
 * The interactor owns the option lists including their German labels, so every screen that offers
 * these choices renders the same wording. It deliberately owns no colour values — theme previews
 * are rendered by setting `data-theme` on a preview element and letting the token layer do the
 * work.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceInteractor {
  private readonly store = inject(AppearanceStore);

  readonly theme = computed(() => this.store.preferences().theme);
  readonly textSize = computed(() => this.store.preferences().textSize);
  readonly motion = computed(() => this.store.preferences().motion);

  readonly themeOptions: readonly AppearanceOption<ThemeId>[] = [
    { id: 'amazone', label: 'Amazone', description: null },
    { id: 'warm', label: 'Sonnenuntergang', description: null },
    { id: 'nacht', label: 'Mitternacht', description: null },
    { id: 'lila', label: 'Lavendel', description: null },
  ];

  readonly textSizeOptions: readonly AppearanceOption<TextSizeId>[] = [
    {
      id: 'system',
      label: 'Systemeinstellung',
      description: 'Die App übernimmt die Textgröße deines Geräts.',
    },
    { id: 'small', label: 'Klein', description: null },
    { id: 'medium', label: 'Mittel', description: null },
    { id: 'large', label: 'Groß', description: null },
    { id: 'xlarge', label: 'Sehr groß', description: null },
    { id: 'xxlarge', label: 'Riesig', description: null },
  ];

  readonly motionOptions: readonly AppearanceOption<MotionId>[] = [
    {
      id: 'system',
      label: 'Systemeinstellung',
      description: 'Übernimmt die Einstellung deines Geräts.',
    },
    {
      id: 'reduced',
      label: 'Reduziert',
      description: 'Reduziert Bewegungen und Übergänge in der App.',
    },
    {
      id: 'standard',
      label: 'Standard',
      description: 'Zeigt die regulären Animationen der App.',
    },
  ];

  /** The label of the currently selected theme, for the settings overview. */
  readonly themeLabel = computed(() => labelOf(this.themeOptions, this.theme()));
  readonly textSizeLabel = computed(() => labelOf(this.textSizeOptions, this.textSize()));
  readonly motionLabel = computed(() => labelOf(this.motionOptions, this.motion()));

  selectTheme(theme: ThemeId): void {
    this.store.update({ theme });
  }

  selectTextSize(textSize: TextSizeId): void {
    this.store.update({ textSize });
  }

  selectMotion(motion: MotionId): void {
    this.store.update({ motion });
  }
}

function labelOf<TId extends string>(options: readonly AppearanceOption<TId>[], id: TId): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
