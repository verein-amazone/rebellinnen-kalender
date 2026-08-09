import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A calendar's colour and emoji as a small circle, e.g. the calendar picker's rows and its trigger.
 * Purely decorative — the calendar is always named in text next to it — so the circle itself is
 * `aria-hidden`.
 */
@Component({
  selector: 'app-calendar-avatar',
  host: { class: 'inline-block' },
  templateUrl: './calendar-avatar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarAvatar {
  readonly color = input<string | null>(null);
  readonly emoji = input<string | null>(null);
}
