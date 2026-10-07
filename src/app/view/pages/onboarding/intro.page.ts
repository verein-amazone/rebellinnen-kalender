import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideBell,
  LucideBellOff,
  LucideBellRing,
  LucideBookOpen,
  LucideCalendarDays,
  LucideChevronsRight,
  LucideShieldCheck,
  LucideSun,
} from '@lucide/angular';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';
import { reminderLabel } from '@app/interactors/notifications/reminder-labels';
import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';
import {
  AppearanceInteractor,
  type ThemeId,
} from '@app/interactors/settings/appearance.interactor';
import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';

type IntroStepId = 'welcome' | 'areas' | 'personal' | 'privacy' | 'reminders';

interface IntroStep {
  readonly id: IntroStepId;
  readonly heading: string;
}

const STEPS: readonly IntroStep[] = [
  { id: 'welcome', heading: 'Schön, dass du da bist!' },
  { id: 'areas', heading: 'Was kann die App?' },
  { id: 'personal', heading: 'Mach die App zu deiner' },
  { id: 'privacy', heading: 'Deine Daten bleiben bei dir' },
];

/** Only the apps can deliver a reminder, so the browser build skips this step. */
const REMINDERS_STEP: IntroStep = { id: 'reminders', heading: 'An Termine erinnern?' };

/**
 * The first-launch introduction (#82): a few short screens before the app opens on Heute, and
 * reopenable from the settings. It is skippable from its first step; past that, „Zurück“ and
 * „Weiter“ are the only actions, so every step keeps the same two-button footer.
 *
 * Each step is its own URL (`/intro/2`) rather than component state. Navigation is what moves focus
 * to the new heading and announces it (`PageFocus`), so a step change behaves like any other screen
 * change for a screen reader, and the page never has to manage focus itself. Steps replace each
 * other in the history, so the platform back gesture leaves the introduction rather than paging
 * back through it; „Zurück“ is a visible button instead. The step reached is remembered, so an
 * introduction interrupted by closing the app continues where it was left on the next launch.
 *
 * The „Mach die App zu deiner“ step offers the two settings that make the app feel like one's own -
 * the name Heute greets with and the colour theme - through the same interactors as their settings
 * screens. Both are optional; „Weiter“ works with neither touched.
 *
 * Calendar access is only explained here, and requested from the explicit „connect“ action in the
 * settings. The one permission the introduction can ask for is the notification permission (#81),
 * and only when the user taps „Ja, erinnere mich“ on the last step.
 */
@Component({
  selector: 'app-intro',
  host: { class: 'block' },
  imports: [
    ChoiceRow,
    LucideArrowLeft,
    LucideArrowRight,
    LucideBell,
    LucideBellOff,
    LucideBellRing,
    LucideBookOpen,
    LucideCalendarDays,
    LucideChevronsRight,
    LucideShieldCheck,
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
  protected readonly profile = inject(ProfileInteractor);
  protected readonly appearance = inject(AppearanceInteractor);
  private readonly haptics = inject(HapticsInteractor);

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

  /** Reminders already on (e.g. reopened from the settings) need no question. */
  protected readonly heading = computed(() =>
    this.current().id === 'reminders' && this.notificationPreferences.enabled()
      ? 'Erinnerungen sind an'
      : this.current().heading,
  );

  /**
   * „15 Minuten vorher, ganztägig 1 Tag vorher um 09:00“ - what saying yes turns on, as one
   * sentence. Empty when neither kind has a default.
   */
  protected readonly defaultReminders = computed(() => {
    const timed = this.notificationPreferences
      .timedDefaults()
      .map((minutes) => reminderLabel(minutes, false))
      .join(', ');
    const allDay = this.notificationPreferences
      .allDayDefaults()
      .map((minutes) => reminderLabel(minutes, true))
      .join(', ');
    const sentence = [timed, allDay && `ganztägig ${allDay}`].filter(Boolean).join(', ');
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  });

  /** Same as Settings → Profil: stored as typed, so leaving the step needs no save. */
  protected updateName(value: string): void {
    this.profile.setName(value);
  }

  /** Same as Settings → Farbthema: the screen recolours at once, which is the preview. */
  protected selectTheme(theme: ThemeId): void {
    this.appearance.selectTheme(theme);
    void this.haptics.selection();
  }

  /** Asks for the permission from this tap, then finishes whatever the answer. */
  protected async enableReminders(): Promise<void> {
    await this.notificationPreferences.setEnabled(true);
    await this.finish();
  }

  protected readonly destination = computed(() => safeInAppUrl(this.returnTo()) ?? '/today');

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
