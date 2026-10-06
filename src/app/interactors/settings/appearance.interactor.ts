import { computed, inject, Injectable } from '@angular/core';

import { SystemReducedMotion } from '@app/cross-cutting/infrastructure/system-reduced-motion';
import { AppearanceStore } from '@app/data/stores/appearance.store';
import type {
  MotionId,
  TextSizeId,
  ThemeId,
  VibrationId,
} from '@app/data/stores/appearance-preferences';
import type { ChoiceOption } from '@app/interactors/choice-option';

export type { MotionId, TextSizeId, ThemeId, VibrationId };

/** A selectable appearance option. The shape is shared with the other settings screens. */
export type AppearanceOption<TId extends string> = ChoiceOption<TId>;

/**
 * Reading and changing the appearance preferences: colour theme, text size, animations and
 * vibration - everything under „Darstellung & Bedienung“ that applies app-wide.
 *
 * The interactor owns the option lists including their German labels, so every screen that offers
 * these choices renders the same wording. It deliberately owns no colour values - theme previews
 * are rendered by setting `data-theme` on a preview element and letting the token layer do the
 * work.
 */
@Injectable({ providedIn: 'root' })
export class AppearanceInteractor {
  private readonly store = inject(AppearanceStore);
  private readonly systemReducedMotion = inject(SystemReducedMotion);

  readonly theme = computed(() => this.store.preferences().theme);
  readonly textSize = computed(() => this.store.preferences().textSize);
  readonly motion = computed(() => this.store.preferences().motion);
  readonly vibration = computed(() => this.store.preferences().vibration);

  /**
   * Whether animations are reduced right now: by the app's own setting, or by the device's while
   * the app follows it. The same rule `base.css` applies, for the places that have to know in code.
   */
  readonly motionReduced = computed(() => {
    const motion = this.motion();
    return motion === 'reduced' || (motion === 'system' && this.systemReducedMotion.reduced());
  });

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

  readonly vibrationOptions: readonly AppearanceOption<VibrationId>[] = [
    {
      id: 'on',
      label: 'Ein',
      description:
        'Kurze Vibrationen bestätigen, was du getan hast, und der Tagesimpuls begrüßt dich damit.',
    },
    { id: 'off', label: 'Aus', description: 'Die App vibriert nie.' },
  ];

  /** The label of the currently selected theme, for the settings overview. */
  readonly themeLabel = computed(() => labelOf(this.themeOptions, this.theme()));
  readonly textSizeLabel = computed(() => labelOf(this.textSizeOptions, this.textSize()));
  readonly motionLabel = computed(() => labelOf(this.motionOptions, this.motion()));
  readonly vibrationLabel = computed(() => labelOf(this.vibrationOptions, this.vibration()));

  selectTheme(theme: ThemeId): void {
    this.store.update({ theme });
  }

  selectTextSize(textSize: TextSizeId): void {
    this.store.update({ textSize });
  }

  selectMotion(motion: MotionId): void {
    this.store.update({ motion });
  }

  selectVibration(vibration: VibrationId): void {
    this.store.update({ vibration });
  }
}

function labelOf<TId extends string>(options: readonly AppearanceOption<TId>[], id: TId): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
