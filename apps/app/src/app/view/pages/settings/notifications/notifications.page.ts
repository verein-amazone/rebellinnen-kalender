import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { LucideExternalLink } from '@lucide/angular';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import {
  NotificationPreferencesInteractor,
  type NotificationPermission,
} from '@app/interactors/notifications/notification-preferences.interactor';
import { NotificationsBlockedBlock } from '@app/view/blocks/notifications-blocked/notifications-blocked.block';
import { CheckHaptics } from '@app/view/components/field/check-haptics';
import { ReminderListField } from '@app/view/components/reminder-list-field/reminder-list-field';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/**
 * „Benachrichtigungen“ (#81): one switch for appointment reminders as a whole and, while it is on,
 * the reminders a new appointment starts with - separately for timed and all-day appointments.
 * Each appointment can still set its own in the appointment form.
 */
@Component({
  selector: 'app-settings-notifications',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [
    CheckHaptics,
    FocusedScreenScaffold,
    LucideExternalLink,
    NotificationsBlockedBlock,
    ReminderListField,
  ],
  templateUrl: './notifications.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  protected readonly preferences = inject(NotificationPreferencesInteractor);

  protected readonly permission = signal<NotificationPermission | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    void this.readPermission();
    // The permission changes in the system settings, which „Einstellungen öffnen“ leads to, so it
    // is read again on the way back (#147).
    const stopWatchingResumes = inject(AppLifecycle).onResume(() => void this.readPermission());
    inject(DestroyRef).onDestroy(stopWatchingResumes);
  }

  protected async toggle(event: Event): Promise<void> {
    const control = event.target as HTMLInputElement;
    this.busy.set(true);
    try {
      this.permission.set(await this.preferences.setEnabled(control.checked));
    } finally {
      this.busy.set(false);
      // A declined permission leaves reminders off, which the binding cannot express: the signal
      // never changed, so the checkbox the user just ticked is reset by hand.
      control.checked = this.preferences.enabled();
    }
  }

  protected setDefaults(kind: 'timed' | 'allDay', reminders: readonly number[]): void {
    this.preferences.setDefaults(kind, reminders);
  }

  protected openSystemSettings(): void {
    void this.preferences.openSystemSettings();
  }

  private async readPermission(): Promise<void> {
    this.permission.set(await this.preferences.permission());
  }
}
