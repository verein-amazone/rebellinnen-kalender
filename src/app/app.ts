import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { DocumentAppearance } from '@app/cross-cutting/infrastructure/document-appearance';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly appearance = inject(AppearanceInteractor);
  private readonly documentAppearance = inject(DocumentAppearance);

  constructor() {
    // The selected appearance is applied in one place, for the whole app, whenever it changes.
    effect(() => {
      this.documentAppearance.apply({
        theme: this.appearance.theme(),
        textSize: this.appearance.textSize(),
        motion: this.appearance.motion(),
      });
    });
  }
}
