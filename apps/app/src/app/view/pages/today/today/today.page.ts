import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideSettings } from '@lucide/angular';
import { RouterLink } from '@angular/router';

import { formatDayLong } from '@app/cross-cutting/helpers/date-format';
import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ReminderListBlock } from '@app/view/blocks/reminder-list/reminder-list.block';
import { TodayAppointmentsBlock } from '@app/view/blocks/today-appointments/today-appointments.block';
import { TodayClosingBlock } from '@app/view/blocks/today-closing/today-closing.block';
import { TodayGreetingBlock } from '@app/view/blocks/today-greeting/today-greeting.block';
import { TodayImpulseBlock } from '@app/view/blocks/today-impulse/today-impulse.block';

@Component({
  selector: 'app-today',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    RouterLink,
    LucideSettings,
    ReminderListBlock,
    TodayAppointmentsBlock,
    TodayClosingBlock,
    TodayGreetingBlock,
    TodayImpulseBlock,
  ],
  templateUrl: './today.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayPage {
  private readonly currentDay = inject(LocalDay);

  protected readonly today = this.currentDay.day;
  protected readonly dateLabel = computed(() => formatDayLong(this.today()));
}
