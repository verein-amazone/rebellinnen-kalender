import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideBell,
  LucideBellOff,
  LucideBellRing,
  LucideBookOpen,
  LucideCalendarDays,
  LucideChevronsRight,
  LucideSettings,
  LucideShieldCheck,
  LucideSun,
} from '@lucide/angular';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { CuratedCalendarsInteractor } from '@app/interactors/calendar/curated-calendars.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { NotificationPreferencesInteractor } from '@app/interactors/notifications/notification-preferences.interactor';
import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';
import {
  AppearanceInteractor,
  type ThemeId,
} from '@app/interactors/settings/appearance.interactor';
import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';
import { CalendarAvatar } from '@app/view/components/calendar-avatar/calendar-avatar';
import { ChoiceRow } from '@app/view/components/choice-row/choice-row';
import { ToggleField } from '@app/view/components/field/toggle-field';
import { ThemeSwatch } from '@app/view/components/theme-swatch/theme-swatch';
import { HardwareBack } from '@app/cross-cutting/infrastructure/hardware-back';

type IntroStepId = 'welcome' | 'areas' | 'personal' | 'calendars' | 'privacy' | 'reminders';

interface IntroStep {
  readonly id: IntroStepId;
  readonly heading: string;
}

const WELCOME_STEP: IntroStep = { id: 'welcome', heading: 'Schön, dass du da bist!' };
const AREAS_STEP: IntroStep = { id: 'areas', heading: 'Was kann die App?' };
const PERSONAL_STEP: IntroStep = { id: 'personal', heading: 'Mach deine App einzigartig!' };
const PRIVACY_STEP: IntroStep = { id: 'privacy', heading: 'Deine Daten bleiben bei dir.' };

/** Only the apps can download a calendar feed, so the browser build skips this step. */
const CALENDARS_STEP: IntroStep = { id: 'calendars', heading: 'Welche Kalender willst du sehen?' };

/** Only the apps can deliver a reminder, so the browser build skips this step. */
const REMINDERS_STEP: IntroStep = {
  id: 'reminders',
  heading: 'Willst du an Termine erinnert werden?',
};

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
 * The „Mach deine App einzigartig!“ step offers the two settings that make the app feel like one's own -
 * the name Heute greets with and the colour theme - through the same interactors as their settings
 * screens. Both are optional; „Weiter“ works with neither touched.
 *
 * The „Welche Kalender“ step lists the curated online calendars from
 * `public/curated-calendars/catalog.json` - whatever it lists, so a new catalog entry needs no
 * change here - and lets each be switched off before the app first downloads it. Listing them seeds
 * them but downloads nothing; the first download happens on the first calendar-showing screen,
 * for the ones still on.
 *
 * The first step links the terms of use - the one step every user sees, including those who skip -
 * and the privacy step links the privacy policy. They are links, not something to accept: the
 * privacy policy is information, the app asks for no consent, and the terms only restate the law
 * (see docs/store-sign-off-1.0.0.md).
 *
 * Device calendar access is only explained here, and requested from the explicit „connect“ action in the
 * settings. The one permission the introduction can ask for is the notification permission (#81),
 * and only when the user taps „Ja, erinnere mich“ on the last step.
 */
@Component({
  selector: 'app-intro',
  host: { class: 'block' },
  imports: [
    CalendarAvatar,
    ChoiceRow,
    LucideArrowLeft,
    LucideArrowRight,
    LucideBell,
    LucideBellOff,
    LucideBellRing,
    LucideBookOpen,
    LucideCalendarDays,
    LucideChevronsRight,
    LucideSettings,
    LucideShieldCheck,
    LucideSun,
    RouterLink,
    ThemeSwatch,
    ToggleField,
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
  private readonly curatedCalendars = inject(CuratedCalendarsInteractor);

  /** Bound from the `:step` route parameter, 1-based. */
  readonly step = input<string>('1');
  /** Bound from `?returnTo=`: where finishing goes when reopened from the settings. */
  readonly returnTo = input<string | null>(null);

  protected readonly steps: readonly IntroStep[] = [
    WELCOME_STEP,
    AREAS_STEP,
    PERSONAL_STEP,
    ...(this.isNativePlatform ? [CALENDARS_STEP] : []),
    PRIVACY_STEP,
    ...(this.notificationPreferences.isSupported ? [REMINDERS_STEP] : []),
  ];

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
      ? 'Erinnerungen sind an.'
      : this.current().heading,
  );

  /** Loaded only on the calendars step, so the earlier steps never touch the database. */
  protected readonly calendars = resource({
    params: () => (this.current().id === 'calendars' ? true : undefined),
    loader: () => this.curatedCalendars.listForIntroduction(),
  });

  /** Why the last switch on the calendars step failed; cleared by the next one. */
  protected readonly calendarError = signal<string | null>(null);

  /** Same as Settings → Profil: stored as typed, so leaving the step needs no save. */
  protected updateName(value: string): void {
    this.profile.setName(value);
  }

  /** Same as Settings → Farbthema: the screen recolours at once, which is the preview. */
  protected selectTheme(theme: ThemeId): void {
    this.appearance.selectTheme(theme);
    void this.haptics.selection();
  }

  /** Same as Settings → Amazone & Partnerkalender, minus the colour and symbol. */
  protected async toggleCalendar(sourceId: string, enabled: boolean): Promise<void> {
    this.calendarError.set(null);
    try {
      await this.curatedCalendars.setEnabled(sourceId, enabled);
    } catch (error) {
      console.warn('Der Kalender konnte nicht umgeschaltet werden.', error);
      this.calendarError.set(
        'Das hat nicht geklappt. Du kannst die Kalender auch später in den Einstellungen ändern.',
      );
    } finally {
      this.calendars.reload();
    }
  }

  /** Asks for the permission from this tap, then finishes whatever the answer. */
  protected async enableReminders(): Promise<void> {
    try {
      await this.notificationPreferences.setEnabled(true);
    } catch (error) {
      // The introduction still has to end; reminders can be switched on in the settings later.
      console.warn('Die Erinnerungen konnten nicht eingeschaltet werden.', error);
    }
    await this.finish();
  }

  /**
   * Where the terms of use and the privacy policy return to: this step, keeping `returnTo` when
   * the introduction was reopened from the settings.
   */
  protected readonly legalReturnTo = computed(() =>
    this.router.serializeUrl(
      this.router.createUrlTree(['/intro', this.index() + 1], {
        queryParams: { returnTo: this.returnTo() },
      }),
    ),
  );

  protected readonly destination = computed(() => safeInAppUrl(this.returnTo()) ?? '/today');

  constructor() {
    // Android's back button steps back through the introduction, like „Zurück“; on the first step
    // nothing takes it, and the app goes to the background.
    inject(DestroyRef).onDestroy(
      inject(HardwareBack).register(() => {
        if (this.isFirst()) {
          return false;
        }
        this.back();
        return true;
      }),
    );
  }

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
