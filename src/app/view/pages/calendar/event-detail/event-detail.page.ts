import { LiveAnnouncer } from '@angular/cdk/a11y';
import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  Injector,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { LucideCheck, LucideExternalLink, LucidePencil, LucideTrash2 } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { formatDayLong } from '@app/cross-cutting/helpers/date-format';
import { deviceLocalDay } from '@app/cross-cutting/helpers/device-local-day';
import {
  AppEventEditingInteractor,
  type AppEventChanges,
} from '@app/interactors/calendar/app-event-editing.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarOccurrencesInteractor } from '@app/interactors/calendar/calendar-occurrences.interactor';
import { DeviceCalendarSyncInteractor } from '@app/interactors/calendar/device-calendar-sync.interactor';
import { EventForm, type AppEventFormResult } from '@app/view/components/event-form/event-form';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';
import { SheetService } from '@app/view/components/sheet/sheet.service';
import {
  ConfirmationDialog,
  type ConfirmationDialogData,
} from '@app/view/dialogs/confirmation/confirmation.dialog';
import {
  RecurrenceScopeDialog,
  type RecurrenceScope,
  type RecurrenceScopeDialogData,
} from '@app/view/dialogs/recurrence-scope/recurrence-scope.dialog';

/**
 * The appointment detail screen: a read view built from `CalendarOccurrence`, an in-place edit
 * mode built on `EventForm`, delete, and the recurring-scope decision for both. No second route for
 * editing — `editing` just swaps which half of the template is shown.
 *
 * Every mutation ends the same way: announce the outcome through the `LiveAnnouncer` (navigating
 * away leaves nothing else to announce it) and return to the occurrence's day in the calendar, per
 * the issue's acceptance criteria.
 */
@Component({
  selector: 'app-event-detail',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    DatePipe,
    EventForm,
    FocusedScreenScaffold,
    LucideCheck,
    LucideExternalLink,
    LucidePencil,
    LucideTrash2,
  ],
  templateUrl: './event-detail.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailPage {
  private readonly occurrencesInteractor = inject(CalendarOccurrencesInteractor);
  private readonly eventEditing = inject(AppEventEditingInteractor);
  private readonly deviceSync = inject(DeviceCalendarSyncInteractor);
  private readonly sheets = inject(SheetService);
  private readonly announcer = inject(LiveAnnouncer);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  /**
   * The edit view's heading and the read view's „Bearbeiten“ button, for moving focus explicitly
   * when `editing` flips. Neither exists until its half of the `@if` in the template is rendered —
   * `viewChild` (not `.required`) reflects that as `undefined` until then, which is also why the
   * lookup is a signal rather than a one-off `ElementRef` grabbed in `ngAfterViewInit`.
   */
  private readonly editHeading = viewChild<ElementRef<HTMLElement>>('editHeading');
  private readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');

  /**
   * Looked up by type, not by a `#eventForm` template reference: the header's checkmark button and
   * `<app-event-form>` live in separate `@if` blocks (each has to have a single root node for content
   * projection into the scaffold's `headerActions`/`footer` slots to work — see the template), so a
   * template reference declared on the form would not be visible from the button's own block.
   * `viewChild` has no such scoping restriction — it searches the whole view.
   */
  private readonly eventFormComponent = viewChild(EventForm);
  protected readonly canSubmitEdit = computed(
    () => this.eventFormComponent()?.canSubmit() ?? false,
  );

  readonly id = input.required<string>();

  protected readonly occurrenceResource = resource({
    params: () => this.id(),
    loader: ({ params }) => this.occurrencesInteractor.findById(params),
  });

  protected readonly occurrence = computed(() => this.occurrenceResource.value() ?? null);

  /**
   * The full record's note, for a consumer whose `CalendarOccurrence` (a list/agenda read model)
   * has no `note` field — both this page's read view and `EventForm`'s edit-mode prefill need it.
   * Only runs for app-owned occurrences: `params` stays `undefined` for device/ICS ones, which
   * skips the loader entirely rather than calling it with a meaningless id.
   */
  private readonly noteResource = resource({
    params: () => this.occurrence()?.itemId ?? undefined,
    loader: ({ params }) =>
      this.eventEditing.findRecord(params).then((record) => record?.note ?? null),
  });

  protected readonly note = computed(() => this.noteResource.value() ?? null);

  protected readonly editing = signal(false);

  protected readonly dateLabel = computed(() => {
    const occurrence = this.occurrence();
    if (occurrence === null) {
      return '';
    }

    return occurrence.startDay === occurrence.endDay
      ? formatDayLong(occurrence.startDay)
      : `${formatDayLong(occurrence.startDay)} – ${formatDayLong(occurrence.endDay)}`;
  });

  protected startEditing(): void {
    this.editing.set(true);
    // The `@if` in the template swaps the whole read view (including the button just activated) for
    // the edit view, which drops focus to `<body>` unless it is moved explicitly. `afterNextRender`
    // waits for that swap to actually land in the DOM before the edit heading is looked up.
    afterNextRender(() => this.editHeading()?.nativeElement.focus(), { injector: this.injector });
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    // Mirrors `startEditing()`: the edit view is swapped back out, so focus returns to the pencil
    // button that opened it.
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * Bound to the scaffold's `beforeDismiss`: while editing, a tap on the header's back-arrow exits
   * edit mode instead of leaving the screen (edit mode has no separate route, so a plain back
   * navigation would otherwise abandon it silently). A second tap, once `editing` is already `false`,
   * falls through to the scaffold's default back navigation.
   */
  /**
   * Where the back-arrow goes. The calendar overview keeps the day being looked at in `?day=`, so
   * a bare `/calendar` would drop the user on today rather than where they opened the appointment
   * from. Until the occurrence has loaded there is no day to return to.
   */
  protected readonly backLink = computed(() => {
    const day = this.occurrence()?.startDay;
    return day === undefined ? '/calendar' : `/calendar?day=${day}`;
  });

  protected readonly handleBeforeDismiss = (): boolean => {
    if (!this.editing()) {
      return false;
    }

    this.cancelEdit();
    return true;
  };

  protected async handleSave(result: AppEventFormResult): Promise<void> {
    if (result.mode !== 'edit') {
      return;
    }

    const occurrence = this.occurrence();
    if (occurrence === null || occurrence.itemId === null) {
      return;
    }

    if (occurrence.seriesId !== null && occurrence.originalStart !== null) {
      const scope = await this.askRecurrenceScope(
        'Was möchtest du ändern?',
        'Dieser Termin gehört zu einer Serie. Was soll geändert werden?',
      );
      if (scope === undefined) {
        return;
      }

      await this.applyScopedEdit(
        scope,
        occurrence.seriesId,
        occurrence.originalStart,
        result.changes,
      );
    } else {
      await this.eventEditing.updateAll(occurrence.itemId, result.changes);
    }

    this.editing.set(false);
    this.announcer.announce('Termin gespeichert');
    // The user may have moved the appointment to a different day; navigate to wherever it ended up
    // rather than back to the day it used to be on. `result.changes.start` is only set when the
    // form actually touched the start, so an edit that left the date alone still resolves to the
    // occurrence's own (unchanged) day.
    await this.navigateToOccurrenceDay(deviceLocalDay(result.changes.start ?? occurrence.start));
  }

  protected confirmDelete(): void {
    const occurrence = this.occurrence();
    if (occurrence === null) {
      return;
    }

    const data: ConfirmationDialogData = {
      message: `„${occurrence.title}“ wird gelöscht. Das kann nicht rückgängig gemacht werden.`,
      confirmLabel: 'Löschen',
      destructive: true,
    };

    this.sheets
      .open<boolean, ConfirmationDialogData>(ConfirmationDialog, {
        heading: 'Termin löschen?',
        data,
      })
      .closed.subscribe((confirmed) => {
        if (confirmed !== true) {
          return;
        }

        void this.performDelete(occurrence);
      });
  }

  protected async openInNativeCalendar(): Promise<void> {
    const occurrence = this.occurrence();
    if (occurrence === null || occurrence.externalId === null) {
      return;
    }

    try {
      await this.deviceSync.openForEditing(occurrence.externalId);
      // `openForEditing` only refreshes the device cache; this page's own `occurrenceResource` still
      // holds whatever it loaded before the user left for the OS calendar app, so it has to be
      // reloaded explicitly once the handoff resolves. If the user moved the occurrence, this can
      // legitimately end up not finding it again — a device occurrence id embeds its start instant —
      // and the "nicht gefunden" read view is the correct, if imperfect, outcome; it is still better
      // than silently showing stale data.
      this.occurrenceResource.reload();
    } catch {
      // Covers a rejected native prompt: the user cancelled, the platform does not support it, or
      // permission was revoked in between. There is nothing to recover — just tell the user rather
      // than leaving an unhandled rejection and no feedback at all.
      this.announcer.announce('Der Termin konnte nicht in der Kalender-App geöffnet werden.');
    }
  }

  private async performDelete(occurrence: CalendarOccurrence): Promise<void> {
    if (occurrence.itemId === null) {
      return;
    }

    if (occurrence.seriesId !== null && occurrence.originalStart !== null) {
      const scope = await this.askRecurrenceScope(
        'Was möchtest du löschen?',
        'Dieser Termin gehört zu einer Serie. Was soll gelöscht werden?',
      );
      if (scope === undefined) {
        return;
      }

      switch (scope) {
        case 'occurrence':
          await this.eventEditing.cancelOccurrence(occurrence.seriesId, occurrence.originalStart);
          break;
        case 'following':
          await this.eventEditing.deleteFollowing(occurrence.seriesId, occurrence.originalStart);
          break;
        case 'all':
          await this.eventEditing.deleteItem(occurrence.itemId);
      }
    } else {
      await this.eventEditing.deleteItem(occurrence.itemId);
    }

    this.announcer.announce('Termin gelöscht');
    await this.navigateToOccurrenceDay(occurrence.startDay);
  }

  private async applyScopedEdit(
    scope: RecurrenceScope,
    seriesId: string,
    originalStart: string,
    changes: AppEventChanges,
  ): Promise<void> {
    switch (scope) {
      case 'occurrence':
        await this.eventEditing.updateOccurrence(seriesId, originalStart, changes);
        return;
      case 'following':
        await this.eventEditing.updateFollowing(seriesId, originalStart, changes);
        return;
      case 'all':
        await this.eventEditing.updateAll(seriesId, changes);
    }
  }

  private askRecurrenceScope(
    heading: string,
    message: string,
  ): Promise<RecurrenceScope | undefined> {
    return firstValueFrom(
      this.sheets.open<RecurrenceScope, RecurrenceScopeDialogData>(RecurrenceScopeDialog, {
        heading,
        data: { message },
      }).closed,
    );
  }

  private async navigateToOccurrenceDay(day: string): Promise<void> {
    // Replaces rather than pushes: the appointment the user just saved or deleted must not be
    // reachable again by the platform back gesture. Same reasoning as `FocusedScreenScaffold`.
    await this.router.navigate(['/calendar'], { queryParams: { day }, replaceUrl: true });
  }
}
