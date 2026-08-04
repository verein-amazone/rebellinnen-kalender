import { ChangeDetectionStrategy, Component } from '@angular/core';

import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-new-event',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './new-event.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewEventPage {}
