import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { greetingText, selectGreeting } from '@app/interactors/today/today-greeting';
import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';

/**
 * The Today page's header greeting: a time-of-day greeting, the stored name if there is one, and
 * the personal emoji — tapping it opens the emoji picker directly from here, per the issue.
 *
 * The greeting hour is read at evaluation time rather than tracked by a dedicated clock signal;
 * `LocalDay.day()` is read only to give the `computed` a recompute trigger on a day change, the
 * same tradeoff `TodayClosingBlock` already makes for its own time-of-day check.
 */
@Component({
  selector: 'app-today-greeting',
  host: { class: 'block' },
  templateUrl: './today-greeting.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayGreetingBlock {
  private readonly profile = inject(ProfileInteractor);
  private readonly currentDay = inject(LocalDay);

  protected readonly greeting = computed(() => {
    this.currentDay.day();
    return greetingText(selectGreeting(new Date().getHours()));
  });

  protected readonly name = this.profile.name;
  protected readonly emoji = this.profile.emoji;

  protected async openEmojiPicker(): Promise<void> {
    await this.profile.pickEmoji();
  }
}
