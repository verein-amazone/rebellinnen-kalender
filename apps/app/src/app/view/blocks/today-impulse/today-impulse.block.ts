import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideChevronRight,
  LucideClapperboard,
  LucideRotateCw,
  LucideSparkle,
} from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { ShakeInteractor } from '@app/interactors/feedback/shake.interactor';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';

/**
 * The Today page's featured content card (#1): today's stable "Wissen" piece or Rebell*in, the
 * whole card a single link into the full item.
 *
 * The card names itself „Für dich“ and nothing else - the content type is on the detail screen,
 * where it belongs; on Today it competed with the one label that matters. The label addresses the
 * reader, as testers asked; the feature behind it keeps the name „Tagesimpuls“ in Einstellungen
 * and in this card's empty and error states. The card leads with the item's picture and its title,
 * as Verein Amazone asked; the teaser is left for the detail screen. Loaded and resolved to view state
 * here, the same split `TodayClosingBlock` uses, so `today.page.html` stays a thin shell.
 *
 * No bookmark toggle here - bookmarking lives on the detail view only, so this card has exactly
 * one action (open the item) rather than two competing tap targets.
 *
 * Falls back to the page's original "Heute gibt es noch keinen Tagesimpuls." copy when nothing is
 * eligible, rather than rendering a broken or misleading card.
 *
 * The card greets with a short wave and a haptic pattern in the same rhythm. When is the user's
 * call on the Tagesimpuls settings page, and `DailyImpulseInteractor` decides it: by default every
 * time the app is opened - a cold start or a return from the background, not a switch between
 * tabs - otherwise once a day or never. Shaking the phone replays it, which is an extra on top of a
 * card that is always reachable by tapping, never the only way to anything.
 *
 * Both channels are decoration: the card's content never depends on either, a reduced-motion
 * preference neutralises the animation via `base.css`, and the app-wide vibration setting turns the
 * buzz off.
 */
@Component({
  selector: 'app-today-impulse',
  host: { class: 'block' },
  imports: [
    LucideChevronRight,
    LucideClapperboard,
    LucideRotateCw,
    LucideSparkle,
    NgTemplateOutlet,
    RouterLink,
  ],
  templateUrl: './today-impulse.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayImpulseBlock {
  private readonly daily = inject(DailyImpulseInteractor);
  private readonly currentDay = inject(LocalDay);
  private readonly haptics = inject(HapticsInteractor);
  private readonly shake = inject(ShakeInteractor);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = resource({
    params: () => ({ today: this.currentDay.day() }),
    loader: ({ params: { today } }) => this.daily.featuredItem(today),
  });

  protected readonly item = computed<ContentItemView | null>(() => valueOr(this.data, null));

  /**
   * Whether the card bleeds a picture to its edges: today's item has one, or it is still loading and
   * the placeholder takes the picture's place, so the card does not change shape when it arrives.
   * Every catalog item ships an image; one without would fall back to its title and teaser rather
   * than an empty frame.
   */
  protected readonly leadsWithImage = computed(
    () => this.data.status() === 'loading' || (this.item()?.imagePath ?? null) !== null,
  );

  /**
   * Latched rather than derived: marking the greeting done immediately flips the interactor's answer,
   * and a computed would drop the class again in the same tick and cut the animation short.
   */
  protected readonly isNew = signal(false);

  /** A shake asks for the greeting deliberately, so its replay takes half again as long. */
  protected readonly isStretched = signal(false);

  constructor() {
    // `shouldGreet` reads signals only, so this runs again when the app is reopened while Today is
    // on screen, or when the day changes - no resume listener of its own needed here.
    effect(() => {
      const today = this.currentDay.day();
      if (this.item() === null || !this.daily.shouldGreet(today)) {
        return;
      }

      untracked(() => {
        this.daily.markGreeted(today);
        this.playGreeting(false);
      });
    });

    void this.watchShakes();
  }

  /** A shake asks for the greeting again - unless the user switched it off. */
  private replayGreeting(): void {
    if (this.item() === null || !this.daily.greetingEnabled()) {
      return;
    }

    this.playGreeting(true);
  }

  /**
   * Plays the greeting, restarting it if the class is still on the card from an earlier one. The
   * class has to leave the element and come back for the CSS animation to restart, and the two
   * writes have to land in different frames - hence the `requestAnimationFrame` rather than a plain
   * reset-then-set. The haptics interactor gates its own channel on the vibration setting, and
   * `base.css` neutralises the wave under reduced motion.
   */
  private playGreeting(replay: boolean): void {
    const start = (): void => {
      this.isStretched.set(replay);
      this.isNew.set(true);
      void this.haptics.playArrival({ replay });
    };

    if (!this.isNew()) {
      start();
      return;
    }

    this.isNew.set(false);
    requestAnimationFrame(start);
  }

  /**
   * `light` on purpose: the greeting is a friendly extra, so a small shake should already reach it.
   * At the plugin's default the phone has to be shaken hard enough that people stop trying.
   */
  private async watchShakes(): Promise<void> {
    const stop = await this.shake.watch(() => this.replayGreeting(), { sensitivity: 'light' });
    // Today may already be gone by the time the sensor is listening: a cleanup registered on a
    // destroyed view throws, and the sensor would keep running.
    if (this.destroyRef.destroyed) {
      stop();
      return;
    }
    this.destroyRef.onDestroy(stop);
  }

  protected reload(): void {
    this.data.reload();
  }
}
