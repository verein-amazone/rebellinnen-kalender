import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ThemeId } from '@app/interactors/settings/appearance.interactor';

/**
 * The colour preview next to a theme option: background, primary and text colour as three dots, so
 * the preview also shows how the theme's text reads on its background.
 *
 * It is rendered by switching the token layer on the element itself, so no colour value has to be
 * duplicated in TypeScript.
 *
 * Purely decorative: the option's label carries the meaning, so the whole swatch is hidden from
 * assistive technology.
 */
@Component({
  selector: 'app-theme-swatch',
  host: {
    class: 'border-border flex shrink-0 gap-1 rounded-md border p-1',
    'aria-hidden': 'true',
    '[attr.data-theme]': 'theme()',
  },
  template: `
    @for (dot of dots; track dot) {
      <span class="size-5 rounded-full" [class]="dot"></span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeSwatch {
  readonly theme = input.required<ThemeId>();

  protected readonly dots = ['bg-background', 'bg-primary', 'bg-foreground'] as const;
}
