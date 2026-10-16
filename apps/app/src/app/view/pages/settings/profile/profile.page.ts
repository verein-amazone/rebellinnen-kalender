import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-settings-profile',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './profile.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly profile = inject(ProfileInteractor);
  protected readonly maxLength = this.profile.nameMaxLength;

  protected updateName(value: string): void {
    this.profile.setName(value);
  }
}
