import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideChevronRight, LucideSparkle } from '@lucide/angular';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import type { ContentItemView } from '@app/interactors/daily-content/content-item.vm';
import { DailyImpulseInteractor } from '@app/interactors/daily-content/daily-impulse.interactor';
import { HapticsInteractor } from '@app/interactors/feedback/haptics.interactor';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import { ShakeInteractor } from '@app/interactors/feedback/shake.interactor';

/**
 * The Today page's featured content card (#1): today's stable "Wissen & Impulse" piece or
 * Rebell*in, the whole card a single link into the full item.
 *
 * The card names itself „Tagesimpuls“ and nothing else - the content type is on the detail screen,
 * where it belongs; on Today it competed with the one label that matters. Two layouts, chosen by
 * the entry's own `dailyRender`: an image-led one for the entries whose picture says more than
 * their teaser does, and the teaser-led one for everything else. Loaded and resolved to view state
 * here, the same split `TodayClosingBlock` uses, so `today.page.html` stays a thin shell.
 *
 * No bookmark toggle here - bookmarking lives on the detail view only, so this card has exactly
 * one action (open the item) rather than two competing tap targets.
 *
 * Falls back to the page's original "Heute gibt es noch keinen Tagesimpuls." copy when nothing is
 * eligible, rather than rendering a broken or misleading card.
 *
 * The first time a day's impulse is shown the card announces itself with a short wave and a haptic
 * greeting in the same rhythm, so it reads as "this is new" rather than as the same card that was
 * there yesterday. It plays once per day: `DailyImpulseInteractor` remembers that the day's impulse
 * was seen, so a reopened app or a return to Today stays still. Shaking the phone replays it, which
 * is an extra on top of a card that is always reachable by tapping, never the only way to anything.
 *
 * Both channels are decoration: the card's content never depends on either, a reduced-motion
 * preference neutralises the animation via `base.css`, and the Tagesimpuls preference on
 * „Bewegung & Animationen“ turns the buzz, or the whole greeting, off.
 */
@Component({
  selector: 'app-today-impulse',
  host: { class: 'block' },
  imports: [NgTemplateOutlet, RouterLink, LucideChevronRight, LucideSparkle],
  templateUrl: './today-impulse.block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayImpulseBlock {
  private readonly daily = inject(DailyImpulseInteractor);
  private readonly currentDay = inject(LocalDay);
  private readonly haptics = inject(HapticsInteractor);
  private readonly appearance = inject(AppearanceInteractor);
  private readonly shake = inject(ShakeInteractor);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly data = resource({
    params: () => ({ today: this.currentDay.day() }),
    loader: ({ params: { today } }) => this.daily.featuredItem(today),
  });

  protected readonly item = computed<ContentItemView | null>(() => this.data.value() ?? null);

  /**
   * Whether today's item leads with its picture instead of its teaser - an editorial call carried
   * per entry in the catalog (`dailyRender`). An item marked that way without an image falls back
   * to the teaser layout rather than rendering an empty frame.
   */
  protected readonly leadsWithImage = computed(() => {
    const content = this.item();
    return content !== null && content.dailyRender === 'image' && content.imagePath !== null;
  });

  /**
   * Latched rather than derived: marking the day as seen immediately flips the interactor's answer,
   * and a computed would drop the class again in the same tick and cut the animation short.
   */
  protected readonly isNew = signal(false);

  /** A shake asks for the greeting deliberately, so its replay takes half again as long. */
  protected readonly isStretched = signal(false);

  constructor() {
    effect(() => {
      const today = this.currentDay.day();
      if (this.item() === null || !this.daily.isUnseen(today)) {
        return;
      }

      this.greet(false);
      this.daily.markSeen(today);
    });

    void this.watchShakes();
  }

  /**
   * „Ohne Begrüßung“ means neither channel, so nothing happens at all - not even the class, which
   * is what the animation hangs off. The haptics interactor gates its own channel on the same
   * preference, and `base.css` still neutralises the wave under reduced motion on top of this.
   */
  private greet(replay: boolean): void {
    if (this.appearance.impulseGreeting() === 'none') {
      return;
    }

    this.isStretched.set(replay);
    this.isNew.set(true);
    void this.haptics.playArrival({ replay });
  }

  /**
   * Replays the greeting. The class has to leave the element and come back for the CSS animation to
   * restart, and the two writes have to land in different frames - hence the `requestAnimationFrame`
   * rather than a plain reset-then-set.
   */
  private replayGreeting(): void {
    if (this.item() === null) {
      return;
    }

    this.isNew.set(false);
    requestAnimationFrame(() => this.greet(true));
  }

  /**
   * `light` on purpose: the greeting is a friendly extra, so a small shake should already reach it.
   * At the plugin's default the phone has to be shaken hard enough that people stop trying.
   */
  private async watchShakes(): Promise<void> {
    const stop = await this.shake.watch(() => this.replayGreeting(), { sensitivity: 'light' });
    this.destroyRef.onDestroy(stop);
  }

  protected reload(): void {
    this.data.reload();
  }
}
