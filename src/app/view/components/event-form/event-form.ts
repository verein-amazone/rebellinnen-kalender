import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
} from '@angular/core';
import {
  FormRoot,
  applyWhen,
  disabled,
  form,
  maxLengthError,
  required,
  requiredError,
  validate,
  type ValidationError,
} from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';

import { AppCalendarsInteractor } from '@app/interactors/calendar/app-calendars.interactor';
import {
  APP_EVENT_TITLE_MAX_LENGTH,
  type AppEventChanges,
  type AppEventDraft,
  type TemporalValue,
} from '@app/interactors/calendar/app-event-editing.interactor';
import type { CalendarOccurrence } from '@app/interactors/calendar/calendar-occurrence.vm';
import { CalendarPickerField } from '@app/view/components/field/calendar-picker-field';
import { TextareaField } from '@app/view/components/field/textarea-field';
import { TextField } from '@app/view/components/field/text-field';
import { DateTimeField } from './date-time-field';

export type AppEventFormMode = 'create' | 'edit';

/**
 * What the form emits on an explicit save — never on an input change. The shape follows `mode`, so
 * a consumer can hand the payload straight to `AppEventEditingInteractor.create()` (create) or one
 * of its `update*()` methods (edit) without reshaping it.
 */
export type AppEventFormResult =
  | { readonly mode: 'create'; readonly draft: AppEventDraft }
  | { readonly mode: 'edit'; readonly changes: AppEventChanges };

interface EventFormModel {
  readonly calendarId: string;
  readonly title: string;
  readonly location: string;
  readonly note: string;
  readonly allDay: boolean;
  /** `YYYY-MM-DD`, always required. */
  readonly date: string;
  /** `HH:mm`, required unless `allDay` is set. */
  readonly startTime: string;
  /**
   * `YYYY-MM-DD`, always required and independent of `date` — an overnight span (22:00 one day
   * through 02:00 the next) or a multi-day all-day appointment is a normal, directly editable end
   * date rather than hidden bookkeeping.
   */
  readonly endDate: string;
  readonly endTime: string;
}

function blankModel(): EventFormModel {
  return {
    calendarId: '',
    title: '',
    location: '',
    note: '',
    allDay: false,
    date: '',
    startTime: '',
    endDate: '',
    endTime: '',
  };
}

/**
 * The shared create/edit form for an app-owned appointment (event), used by the „Neuer Termin“ page
 * and by the detail page's edit mode (#19).
 *
 * A pure presenter: it never injects `AppEventEditingInteractor`, never persists and never
 * navigates. It only ever emits on `save`, in response to an explicit tap — never as a side
 * effect of an input change — so a consumer that never taps save is guaranteed nothing happened.
 * There is no cancel output: the form itself renders no buttons — the `<form>` element carries a
 * stable `id="event-form"` so a submit button living in the surrounding screen's header chrome can
 * trigger it remotely (the standard HTML `form="event-form"` attribute), and cancelling is entirely
 * the surrounding screen's concern (the scaffold's close/back affordance).
 * The calendar picker is the one exception to "views don't inject interactors": `AppCalendarsInteractor`
 * is the dedicated read-model for it (see the "Components" section of
 * `docs/architecture/frontend-architecture.md`), so the form loads its own choices instead of every
 * caller repeating that fetch.
 *
 * Recurrence is out of scope here — the form always writes `rrule: null` and edits always go through
 * `AppEventChanges`, which has no `rrule`/scope concept either; the recurrence-scope decision (this
 * occurrence / this and following / all) belongs to the presenter that owns save, per the brief for
 * #19.
 */
@Component({
  selector: 'app-event-form',
  host: { class: 'block' },
  imports: [FormRoot, TextField, TextareaField, CalendarPickerField, DateTimeField],
  templateUrl: './event-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventForm {
  private readonly calendarsInteractor = inject(AppCalendarsInteractor);

  readonly mode = input.required<AppEventFormMode>();
  /** Edit mode's prefill source. Ignored in create mode. */
  readonly initialOccurrence = input<CalendarOccurrence | null>(null);
  /**
   * Edit mode's note prefill. `CalendarOccurrence` (`calendar-occurrence.vm.ts`) has no `note` field
   * — it is a list/agenda read model — so the note has to be supplied separately by whatever already
   * reads the full record for the detail page.
   */
  readonly initialNote = input<string | null>(null);
  /**
   * Create mode's date prefill, e.g. the day the user was viewing when they tapped „Neuer Termin“.
   * Ignored in edit mode, where the date comes from `initialOccurrence` instead.
   */
  readonly initialDate = input<string | null>(null);

  /** Emitted once, only from an explicit tap on „Speichern“ with a valid form. */
  readonly save = output<AppEventFormResult>();

  protected readonly maxTitleLength = APP_EVENT_TITLE_MAX_LENGTH;

  private readonly calendarsResource = resource({
    loader: () => this.calendarsInteractor.listWritable(),
  });

  protected readonly calendars = computed(() => this.calendarsResource.value() ?? []);

  /**
   * On a fresh install there is no app calendar yet (creating one is issue #20, "Kalender
   * verwalten") — `listWritable()` resolves to an empty array rather than erroring, so this can only
   * be told apart from "still loading" once the resource has actually settled. Without this check the
   * form silently renders a required picker with nothing to choose, which is a dead end: `calendarId`
   * can never become valid, so save can never succeed and nothing tells the user why.
   */
  protected readonly hasNoWritableCalendars = computed(
    () => !this.calendarsResource.isLoading() && this.calendars().length === 0,
  );

  /**
   * `linkedSignal`, not a plain `signal`, because the initial value has to come from `mode`/
   * `initialOccurrence`/`initialNote` — inputs that are not necessarily set yet while this class's
   * fields are being initialized. `linkedSignal`'s computation runs lazily, the same as `computed`,
   * so it only reads those inputs once the field system actually needs a value (after Angular has
   * resolved the bindings) — and it keeps the user's edits until one of those inputs actually
   * changes, instead of recomputing on every change detection.
   */
  protected readonly model = linkedSignal<EventFormModel>(() => {
    if (this.mode() === 'edit') {
      const occurrence = this.initialOccurrence();
      return occurrence === null
        ? blankModel()
        : modelFromOccurrence(occurrence, this.initialNote());
    }

    const date = this.initialDate();
    if (date === null) {
      return blankModel();
    }

    // Mirrors the date prefill: a fresh appointment starts from "now", rounded up to the next
    // quarter hour, rather than forcing the user to type a start time from a blank field.
    const startTime = Temporal.Now.plainTimeISO().round({
      smallestUnit: 'minute',
      roundingIncrement: 15,
      roundingMode: 'ceil',
    });
    return {
      ...blankModel(),
      date,
      startTime: startTime.toString({ smallestUnit: 'minute' }),
      endDate: date,
      endTime: startTime.add({ hours: 1 }).toString({ smallestUnit: 'minute' }),
    };
  });

  protected readonly form = form(
    this.model,
    (schemaPath) => {
      required(schemaPath.calendarId, { message: 'Bitte wähle einen Kalender.' });
      disabled(schemaPath.calendarId, () => this.mode() === 'edit');

      validate(schemaPath.title, ({ value }) => {
        const trimmed = value().trim();
        if (trimmed.length === 0) {
          return requiredError({ message: 'Bitte gib einen Titel ein.' });
        }
        if (trimmed.length > APP_EVENT_TITLE_MAX_LENGTH) {
          return maxLengthError(APP_EVENT_TITLE_MAX_LENGTH, {
            message: `Der Titel darf höchstens ${APP_EVENT_TITLE_MAX_LENGTH} Zeichen lang sein.`,
          });
        }
        return undefined;
      });

      required(schemaPath.date, { message: 'Bitte wähle ein Datum.' });
      required(schemaPath.endDate, { message: 'Bitte wähle ein Enddatum.' });

      // A date-only order check, so a multi-day all-day appointment cannot end before it starts
      // either — the more precise same-day check below only ever runs for a timed appointment.
      validate(schemaPath.endDate, ({ valueOf }) => {
        const date = valueOf(schemaPath.date);
        const endDate = valueOf(schemaPath.endDate);
        if (date === '' || endDate === '') {
          return undefined;
        }

        if (
          Temporal.PlainDate.compare(
            Temporal.PlainDate.from(endDate),
            Temporal.PlainDate.from(date),
          ) < 0
        ) {
          const error: ValidationError = {
            kind: 'dateOrder',
            message: 'Das Enddatum darf nicht vor dem Startdatum liegen.',
          };
          return error;
        }
        return undefined;
      });

      applyWhen(
        schemaPath,
        ({ valueOf }) => !valueOf(schemaPath.allDay),
        (scoped) => {
          required(scoped.startTime, { message: 'Bitte wähle eine Startzeit.' });
          required(scoped.endTime, { message: 'Bitte wähle eine Endzeit.' });

          validate(scoped.endTime, ({ valueOf }) => {
            const date = valueOf(schemaPath.date);
            const startTime = valueOf(schemaPath.startTime);
            const endDate = valueOf(schemaPath.endDate);
            const endTime = valueOf(schemaPath.endTime);
            if (date === '' || startTime === '' || endDate === '' || endTime === '') {
              // Missing values are already covered by the `required` checks above.
              return undefined;
            }

            const start = Temporal.PlainDateTime.from(`${date}T${startTime}:00`);
            const end = Temporal.PlainDateTime.from(`${endDate}T${endTime}:00`);

            if (Temporal.PlainDateTime.compare(end, start) <= 0) {
              const error: ValidationError = {
                kind: 'timeOrder',
                message: 'Das Ende muss nach dem Beginn liegen.',
              };
              return error;
            }
            return undefined;
          });
        },
      );
    },
    {
      submission: {
        action: async () => {
          this.save.emit(this.buildResult());
        },
      },
    },
  );

  /**
   * The picker always has a value once there is anything to pick: a create-mode form with an empty
   * `calendarId` defaults to the first writable calendar as soon as the list resolves, rather than
   * asking the user to make an otherwise-pointless choice among app calendars they cannot tell
   * apart yet. Edit mode never runs this — `calendarId` there comes from the occurrence being
   * edited and the field is disabled.
   */
  private readonly applyDefaultCalendar = effect(() => {
    if (this.mode() !== 'create') {
      return;
    }

    const calendars = this.calendars();
    const field = this.form.calendarId;
    if (calendars.length > 0 && field().value() === '') {
      field().value.set(calendars[0].id);
    }
  });

  /**
   * `endDate` is a normal, independently editable field — but changing `date` should still carry an
   * overnight span along with it (22:00 one day through 02:00 the next stays a 4-hour span, not
   * collapse to 0 or go negative), the same way it did back when the end date was hidden bookkeeping.
   * Tracks the previous `date` by hand because an `effect` only ever sees the current value.
   */
  private previousDate: string | null = null;
  private readonly shiftEndDateWithStart = effect(() => {
    const date = this.form.date().value();
    const previous = this.previousDate;
    this.previousDate = date;

    if (previous === null || previous === date || date === '') {
      return;
    }

    const endDateField = this.form.endDate;
    const endDate = endDateField().value();
    if (endDate === '') {
      return;
    }

    const delta = Temporal.PlainDate.from(previous).until(Temporal.PlainDate.from(date), {
      largestUnit: 'days',
    }).days;
    endDateField().value.set(Temporal.PlainDate.from(endDate).add({ days: delta }).toString());
  });

  /**
   * Whether an external save button (living in the surrounding screen's header, wired to this form
   * via `form="event-form"`) should be enabled. Public and unprefixed so a parent template can read
   * it through a `#`-reference on `<app-event-form>` — Angular only allows a parent template to
   * access public members of a child.
   */
  readonly canSubmit = computed(() => this.form().dirty());

  private buildResult(): AppEventFormResult {
    const value = this.model();
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = toStartValue(value, deviceZone);
    const end = toEndValue(value, deviceZone);
    const location = emptyToNull(value.location);
    const note = emptyToNull(value.note);

    if (this.mode() === 'create') {
      return {
        mode: 'create',
        draft: {
          calendarId: value.calendarId,
          kind: 'event',
          title: value.title.trim(),
          location,
          note,
          start,
          end,
          rrule: null,
        },
      };
    }

    return {
      mode: 'edit',
      changes: {
        title: value.title.trim(),
        location,
        note,
        start,
        end,
      },
    };
  }
}

function modelFromOccurrence(
  occurrence: CalendarOccurrence,
  initialNote: string | null,
): EventFormModel {
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = toDeviceParts(occurrence.start, deviceZone);
  const end = occurrence.end !== null ? toDeviceParts(occurrence.end, deviceZone) : null;
  // An all-day occurrence's stored end is the exclusive day after the last day it covers (see
  // `toEndValue`) — the end-date picker shows the last day the appointment actually covers, one
  // day before that.
  const endDate = occurrence.allDay
    ? end !== null
      ? Temporal.PlainDate.from(end.date).subtract({ days: 1 }).toString()
      : start.date
    : (end?.date ?? start.date);

  return {
    calendarId: occurrence.calendarId,
    title: occurrence.title,
    location: occurrence.location ?? '',
    note: initialNote ?? '',
    allDay: occurrence.allDay,
    date: start.date,
    startTime: start.time,
    endDate,
    endTime: end?.time ?? '',
  };
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toStartValue(model: EventFormModel, deviceZone: string): TemporalValue {
  if (model.allDay) {
    return { kind: 'date', value: model.date, timeZone: null };
  }
  return { kind: 'zoned', value: `${model.date}T${model.startTime}:00`, timeZone: deviceZone };
}

function toEndValue(model: EventFormModel, deviceZone: string): TemporalValue {
  if (model.allDay) {
    // Storage's end is the exclusive day after the last day covered, so a same-day all-day
    // appointment (`endDate === date`) still stores tomorrow — a multi-day one stores the day
    // after its own `endDate`.
    const end = Temporal.PlainDate.from(model.endDate).add({ days: 1 });
    return { kind: 'date', value: end.toString(), timeZone: null };
  }

  return { kind: 'zoned', value: `${model.endDate}T${model.endTime}:00`, timeZone: deviceZone };
}

/** A `TemporalValue` as a `{date, time}` pair in the device's own zone, for prefilling the form. */
function toDeviceParts(value: TemporalValue, deviceZone: string): { date: string; time: string } {
  switch (value.kind) {
    case 'date':
      return { date: value.value, time: '' };
    case 'zoned': {
      const zoned = Temporal.ZonedDateTime.from(`${value.value}[${value.timeZone}]`).withTimeZone(
        deviceZone,
      );
      return { date: zoned.toPlainDate().toString(), time: toHm(zoned.toPlainTime()) };
    }
    case 'floating': {
      const plain = Temporal.PlainDateTime.from(value.value);
      return { date: plain.toPlainDate().toString(), time: toHm(plain.toPlainTime()) };
    }
    case 'utc': {
      const zoned = Temporal.Instant.from(value.value).toZonedDateTimeISO(deviceZone);
      return { date: zoned.toPlainDate().toString(), time: toHm(zoned.toPlainTime()) };
    }
  }
}

function toHm(time: Temporal.PlainTime): string {
  return time.toString({ smallestUnit: 'minute' });
}
