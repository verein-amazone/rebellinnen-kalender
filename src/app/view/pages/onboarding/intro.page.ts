import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideBell,
  LucideBookOpen,
  LucideCalendarDays,
  LucideSettings,
  LucideShieldCheck,
  LucideSparkles,
  LucideSun,
} from '@lucide/angular';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';
import { reminderLabel } from '@app/interactors/notifications/reminder-labels';
import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

type IntroStepId = 'welcome' | 'areas' | 'privacy' | 'reminders';

interface IntroStep {
  readonly id: IntroStepId;
  readonly heading: string;
}

const STEPS: readonly IntroStep[] = [
  { id: 'welcome', heading: 'Willkommen' },
  { id: 'areas', heading: 'Drei Bereiche' },
  { id: 'privacy', heading: 'Deine Daten bleiben bei dir' },
];

/** Only the apps can deliver a reminder, so the browser build skips this step. */
const REMINDERS_STEP: IntroStep = { id: 'reminders', heading: 'Erinnerungen' };

/**
 * The first-launch introduction (#82): a few short, skippable screens before the app opens on
 * Heute, and reopenable from the settings.
 *
 * Each step is its own URL (`/intro/2`) rather than component state. Navigation is what moves focus
 * to the new heading and announces it (`PageFocus`), so a step change behaves like any other screen
 * change for a screen reader, and the page never has to manage focus itself. Steps replace each
 * other in the history, so the platform back gesture leaves the introduction rather than paging
 * back through it; „Zurück“ is a visible button instead. The step reached is remembered, so an
 * introduction interrupted by closing the app continues where it was left on the next launch.
 *
 * Calendar access is only explained here, and requested from the explicit „connect“ action in the
 * settings. The one permission the introduction can ask for is the notification permission (#81),
 * and only when the user taps „Ja, erinnere mich“ on the last step.
 */
@Component({
  selector: 'app-intro',
  host: { class: 'block' },
  imports: [
    FocusedScreenScaffold,
    LucideBell,
    LucideBookOpen,
    LucideCalendarDays,
    LucideSettings,
    LucideShieldCheck,
    LucideSparkles,
    LucideSun,
  ],
  templateUrl: './intro.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntroPage {
  private readonly intro = inject(IntroInteractor);
  private readonly router = inject(Router);
  protected readonly notificationPreferences = inject(NotificationPreferencesInteractor);
  protected readonly isNativePlatform = inject(DevicePlatformService).platform !== 'web';

  /** Bound from the `:step` route parameter, 1-based. */
  readonly step = input<string>('1');
  /** Bound from `?returnTo=`: where finishing goes when reopened from the settings. */
  readonly returnTo = input<string | null>(null);

  protected readonly steps = this.notificationPreferences.isSupported
    ? [...STEPS, REMINDERS_STEP]
    : STEPS;

  protected readonly index = computed(() => {
    const parsed = Number.parseInt(this.step(), 10);
    return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), this.steps.length) - 1 : 0;
  });

  protected readonly current = computed(() => this.steps[this.index()]);
  protected readonly isFirst = computed(() => this.index() === 0);
  protected readonly isLast = computed(() => this.index() === this.steps.length - 1);

  /** „15 Minuten vorher“ and „1 Tag vorher um 09:00“ - what saying yes turns on. */
  protected readonly defaultReminders = computed(() => ({
    timed: this.notificationPreferences
      .timedDefaults()
      .map((minutes) => reminderLabel(minutes, false))
      .join(', '),
    allDay: this.notificationPreferences
      .allDayDefaults()
      .map((minutes) => reminderLabel(minutes, true))
      .join(', '),
  }));

  /** Asks for the permission from this tap, then finishes whatever the answer. */
  protected async enableReminders(): Promise<void> {
    await this.notificationPreferences.setEnabled(true);
    await this.finish();
  }

  protected readonly destination = computed(() => safeInAppUrl(this.returnTo()) ?? '/today');

  /** Closing from the header counts as skipping, so it is never shown again on its own. */
  protected readonly markSeenBeforeDismiss = (): boolean => {
    this.intro.markSeen();
    return false;
  };

  protected next(): void {
    if (this.isLast()) {
      void this.finish();
      return;
    }
    void this.goTo(this.index() + 2);
  }

  protected back(): void {
    void this.goTo(this.index());
  }

  protected async finish(): Promise<void> {
    this.intro.markSeen();
    await this.router.navigateByUrl(this.destination(), { replaceUrl: true });
  }

  private async goTo(step: number): Promise<void> {
    // Remembered before navigating, so an app closed right after the tap still resumes here.
    this.intro.rememberStep(step);
    await this.router.navigate(['/intro', step], {
      queryParamsHandling: 'preserve',
      replaceUrl: true,
    });
  }
}
