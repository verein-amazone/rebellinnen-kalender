import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';

/**
 * The Today page's closing footer: one headline, an optional supporting line, and — only for the
 * "an appointment is still coming" state — a quiet link to it.
 *
 * Deliberately not `.rk-card`: the issue calls for plain text on the existing background, not
 * another prominent bordered card. The appointment link is the one allowed exception, and even that
 * stays a plain underlined line rather than a full event card.
 */
@Component({
  selector: 'app-today-closing-message',
  host: { class: 'block' },
  imports: [RouterLink],
  templateUrl: './today-closing-message.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayClosingMessage {
  readonly headline = input.required<string>();
  readonly supportingLine = input<string | null>(null);
  readonly appointment = input<CalendarOccurrence | null>(null);
}
