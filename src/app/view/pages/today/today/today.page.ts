import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideSettings } from '@lucide/angular';
import { RouterLink } from '@angular/router';

import { ReminderListBlock } from '@app/view/blocks/reminder-list/reminder-list.block';
import { TodayClosingBlock } from '@app/view/blocks/today-closing/today-closing.block';
import { TodayGreetingBlock } from '@app/view/blocks/today-greeting/today-greeting.block';

@Component({
  selector: 'app-today',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [RouterLink, LucideSettings, ReminderListBlock, TodayClosingBlock, TodayGreetingBlock],
  templateUrl: './today.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPage {}
