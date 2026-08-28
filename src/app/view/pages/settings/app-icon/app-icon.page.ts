import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';

import { AppIconInteractor, type AppIconId } from '@app/interactors/settings/app-icon.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * „App-Symbol“: picks the icon the app shows on the home screen (#9).
 *
 * Unlike the other appearance settings this one is not backed by a store - the operating system
 * owns the active icon - so it uses `resource()` and reloads after every write, the same convention
 * the device-calendar screen follows.
 */
@Component({
  selector: 'app-settings-app-icon',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, ChoiceRow],
  templateUrl: './app-icon.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppIconPage {
  private readonly appIcon = inject(AppIconInteractor);
  private readonly announcer = inject(LiveAnnouncer);

  protected readonly options = this.appIcon.options;
  protected readonly changeNotice = this.appIcon.changeNotice;

  protected readonly iconResource = resource({
    loader: () => this.appIcon.loadSnapshot(),
  });

  protected async select(id: AppIconId): Promise<void> {
    await this.appIcon.select(id);
    this.iconResource.reload();

    // The radios are not a visible confirmation on their own here: the icon that changed lives on
    // the home screen, outside the app.
    await this.announcer.announce(`App-Symbol: ${this.appIcon.labelOf(id)}`);
  }
}
