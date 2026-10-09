import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { PaletteId } from '@app/interactors/settings/appearance.interactor';

/**
 * The colour preview next to a theme option: background, primary and accent as three dots.
 *
 * It is rendered by switching the token layer on the element itself, so no colour value has to be
 * duplicated in TypeScript. Given more than one palette, each dot is split between them - the
 * `system` option shows its light and its dark half side by side.
 *
 * Purely decorative: the option's label carries the meaning, so the whole swatch is hidden from
 * assistive technology.
 */
@Component({
  selector: 'app-theme-swatch',
  host: {
    class: 'border-border flex shrink-0 gap-1 rounded-md border p-1',
    'aria-hidden': 'true',
    '[attr.data-theme]': 'palettes()[0]',
  },
  template: `
    @for (dot of dots; track dot) {
      <span class="flex size-5 overflow-hidden rounded-full">
        @for (palette of palettes(); track palette) {
          <span class="flex-1" [class]="dot" [attr.data-theme]="palette"></span>
        }
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwatch {
  readonly palettes = input.required<readonly PaletteId[]>();

  protected readonly dots = ['bg-background', 'bg-primary', 'bg-accent'] as const;
}
