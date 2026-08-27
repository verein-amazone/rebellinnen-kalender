import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import {
  IcsSubscriptionInteractor,
  IcsSubscriptionNameInvalidError,
  IcsUrlInvalidError,
  type IcsRefreshOutcome,
} from '@app/interactors/calendar/ics-subscription.interactor';
import { SheetRef } from '@app/view/components/sheet/sheet-ref';
import { CALENDAR_NAME_MAX_LENGTH } from '@app/view/dialogs/calendar-identity-edit/calendar-identity-edit.dialog';

export interface IcsSubscriptionAddResult {
  readonly subscriptionId: string;
  readonly outcome: IcsRefreshOutcome;
}

/**
 * Adds a read-only calendar subscription by link, opened from `CalendarsPage`.
 *
 * Closes with the interactor's result once `add()` resolves - even when the first refresh failed,
 * since the subscription still exists and is already visible with its error state; that is not a
 * form failure. Only the two validation errors `add()` can throw before ever touching the network
 * (`IcsSubscriptionNameInvalidError`, `IcsUrlInvalidError`) map to a field's inline error and keep
 * the sheet open; anything else surfaces as a form-level alert, since nothing else would explain the
 * failure to the user.
 */
@Component({
  selector: 'app-ics-subscription-add',
  host: { class: 'block' },
  templateUrl: './ics-subscription-add.dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IcsSubscriptionAddDialog {
  private readonly sheetRef = inject<SheetRef<IcsSubscriptionAddResult>>(SheetRef);
  private readonly icsSubscriptions = inject(IcsSubscriptionInteractor);

  protected readonly maxLength = CALENDAR_NAME_MAX_LENGTH;
  protected readonly name = signal('');
  protected readonly url = signal('');
  protected readonly nameError = signal('');
  protected readonly urlError = signal('');
  protected readonly formError = signal('');
  protected readonly submitting = signal(false);

  protected updateName(value: string): void {
    this.name.set(value);
    if (this.nameError() !== '') {
      this.nameError.set('');
    }
  }

  protected updateUrl(value: string): void {
    this.url.set(value);
    if (this.urlError() !== '') {
      this.urlError.set('');
    }
  }

  protected async save(): Promise<void> {
    const name = this.name().trim();
    const url = this.url().trim();

    this.nameError.set(name === '' ? 'Bitte gib einen Namen ein.' : '');
    this.urlError.set(url === '' ? 'Bitte gib einen Kalender-Link ein.' : '');
    if (name === '' || url === '') {
      return;
    }

    this.formError.set('');
    this.submitting.set(true);
    try {
      const result = await this.icsSubscriptions.add(name, url);
      this.sheetRef.close(result);
    } catch (error) {
      if (error instanceof IcsSubscriptionNameInvalidError) {
        this.nameError.set(error.message);
      } else if (error instanceof IcsUrlInvalidError) {
        this.urlError.set(error.message);
      } else {
        this.formError.set('Der Kalender konnte nicht hinzugefügt werden.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  protected cancel(): void {
    this.sheetRef.close();
  }
}
