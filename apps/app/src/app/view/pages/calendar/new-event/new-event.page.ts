import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LucideCheck } from '@lucide/angular';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { deviceLocalDay } from '@app/cross-cutting/helpers/device-local-day';
import { AppEventEditingInteractor } from '@app/interactors/calendar/app-event-editing.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { EventForm, type AppEventFormResult } from '@app/view/components/event-form/event-form';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { RETURN_NAVIGATION } from '@app/view/scaffolds/main-navigation/scroll-memory';

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
  private readonly haptics = inject(HapticsInteractor);

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
  /**
   * Bound from `?returnTo=`: the screen that opened this form, when that is not the calendar - the
   * Today screen sets it. Both cancelling and saving go back there, because an appointment created
   * from Heute belongs back on Heute even when it was created for another day.
   */
  readonly returnTo = input<string | null>(null);

  /** Only the two known views may travel back into the calendar's `?view=`. */
  private readonly returnView = computed(() => {
    const view = this.view();
    return view === 'week' || view === 'month' ? view : undefined;
  });

  /** `null` unless the caller passed a route of this app - see `safeInAppUrl`. */
  private readonly origin = computed(() => safeInAppUrl(this.returnTo()));

  protected readonly cancelLink = computed(() => {
    const origin = this.origin();
    if (origin !== null) {
      return origin;
    }

    const view = this.returnView();
    return view === undefined ? '/calendar' : `/calendar?view=${view}`;
  });

  /**
   * A save in flight. The form emits on every submit, so without it two quick taps on the check mark
   * would create the appointment twice before the navigation away lands.
   */
  protected readonly saving = signal(false);

  /** Why the last save failed; the form stays filled in so nothing has to be typed again. */
  protected readonly saveError = signal<string | null>(null);

  protected async handleSave(result: AppEventFormResult): Promise<void> {
    if (result.mode !== 'create' || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    try {
      await this.eventEditing.create(result.draft);
    } catch (error) {
      console.warn('Der Termin konnte nicht gespeichert werden.', error);
      this.saveError.set('Der Termin konnte nicht gespeichert werden. Versuche es noch einmal.');
      this.saving.set(false);
      return;
    }

    void this.haptics.confirm();

    // Replaces rather than pushes: the form is finished and must not be reachable again by the
    // platform back gesture. Same reasoning as `FocusedScreenScaffold.dismiss()`.
    const origin = this.origin();
    if (origin !== null) {
      await this.router.navigateByUrl(origin, RETURN_NAVIGATION);
      return;
    }

    await this.router.navigate(['/calendar'], {
      queryParams: { day: deviceLocalDay(result.draft.start), view: this.returnView() },
      replaceUrl: true,
    });
  }
}
