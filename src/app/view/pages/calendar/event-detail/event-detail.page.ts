import { ChangeDetectionStrategy, Component } from '@angular/core';

import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

@Component({
  selector: 'app-event-detail',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [FocusedScreenScaffold],
  templateUrl: './event-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailPage {}
