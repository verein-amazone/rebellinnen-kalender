import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { LucideExternalLink } from '@lucide/angular';

import { AppLifecycle } from '@app/cross-cutting/infrastructure/app-lifecycle';
import {
  NotificationPreferencesInteractor,
  type NotificationPermission,
} from '@app/interactors/notifications/notification-preferences.interactor';

/**
 * Says that reminders are switched on but cannot arrive, because the notification permission was
 * taken away in the system settings afterwards (#150). Without it the reminder settings and the
 * appointment form look as if they were working while the scheduler has nothing to schedule.
 *
 * Where the OS still lets the app ask (Android reports `prompt` after the switch in its app
 * settings), the button asks again; otherwise it opens the system settings. The permission is
 * re-read whenever the app comes back to the foreground, which is how a change made there arrives.
 *
 * When the permission comes back while the notice is showing, a confirmation takes its place and
 * takes the focus if the notice had it, so the button disappearing does not drop focus to the page.
 */
@Component({
  selector: 'app-notifications-blocked',
  host: { class: 'block' },
  imports: [LucideExternalLink],
  templateUrl: './notifications-blocked.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsBlockedBlock {
  private readonly preferences = inject(NotificationPreferencesInteractor);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly permission = signal<NotificationPermission | null>(null);
  protected readonly restored = signal(false);
  protected readonly blocked = computed(() => {
    const permission = this.permission();
    return this.preferences.enabled() && permission !== null && permission !== 'granted';
  });

  private readonly confirmation = viewChild<ElementRef<HTMLElement>>('confirmation');

  constructor() {
    void this.readPermission();
    const stopWatchingResumes = inject(AppLifecycle).onResume(() => void this.readPermission());
    inject(DestroyRef).onDestroy(stopWatchingResumes);
  }

  protected async allow(): Promise<void> {
    this.update(await this.preferences.requestPermission());
  }

  protected openSystemSettings(): void {
    void this.preferences.openSystemSettings();
  }

  private async readPermission(): Promise<void> {
    this.update(await this.preferences.permission());
  }

  private update(permission: NotificationPermission): void {
    if (!this.blocked() || permission !== 'granted') {
      this.permission.set(permission);
      return;
    }

    const hadFocus = this.host.nativeElement.contains(document.activeElement);
    this.permission.set(permission);
    this.restored.set(true);
    if (hadFocus) {
      afterNextRender(() => this.confirmation()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }
}
