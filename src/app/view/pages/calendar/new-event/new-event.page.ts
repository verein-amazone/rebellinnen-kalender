import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideCheck } from '@lucide/angular';

import { deviceLocalDay } from '@app/cross-cutting/helpers/device-local-day';
import { AppEventEditingInteractor } from '@app/interactors/calendar/app-event-editing.interactor';
import { EventForm, type AppEventFormResult } from '@app/view/components/event-form/event-form';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * The „Neuer Termin“ screen: `EventForm` in create mode, wired to
 * `AppEventEditingInteractor.create()`. A pure presenter - it holds no business logic beyond
 * picking where to navigate back to; the form itself never persists or navigates. Cancelling is the
 * scaffold's own `dismissal="close"` (X) affordance - nothing was persisted, so there is nothing this
 * page needs to do beyond what the scaffold's default dismiss already does.
 */
@Component({
  selector: 'app-new-event',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [EventForm, FocusedScreenScaffold, LucideCheck],
  templateUrl: './new-event.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewEventPage {
  private readonly eventEditing = inject(AppEventEditingInteractor);
  private readonly router = inject(Router);

  /**
   * Bound from the `?day=` query param the agenda's „Neuer Termin“ link sets, so the form defaults
   * to the day the user was already looking at. Absent for a deep link or direct navigation.
   */
  readonly day = input<string | undefined>();
  /**
   * Bound from the `?view=` query param that same link carries: the calendar's week/month view, so
   * cancelling or saving returns to the view the user started from rather than the default one.
   */
  readonly view = input<string | undefined>();

  /** Only the two known views may travel back into the calendar's `?view=`. */
  private readonly returnView = computed(() => {
    const view = this.view();
    return view === 'week' || view === 'month' ? view : undefined;
  });

  protected readonly cancelLink = computed(() => {
    const view = this.returnView();
    return view === undefined ? '/calendar' : `/calendar?view=${view}`;
  });

  protected async handleSave(result: AppEventFormResult): Promise<void> {
    if (result.mode !== 'create') {
      return;
    }

    await this.eventEditing.create(result.draft);
    // Replaces rather than pushes: the form is finished and must not be reachable again by the
    // platform back gesture. Same reasoning as `FocusedScreenScaffold.dismiss()`.
    await this.router.navigate(['/calendar'], {
      queryParams: { day: deviceLocalDay(result.draft.start), view: this.returnView() },
      replaceUrl: true,
    });
  }
}
