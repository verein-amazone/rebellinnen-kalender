import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { LucideBookOpen, LucideCalendarDays, LucideSun } from '@lucide/angular';
import { KeyboardVisibility } from '@app/cross-cutting/infrastructure/keyboard-visibility';
import { PageFocus } from '@app/cross-cutting/infrastructure/page-focus';
import { AppearanceInteractor } from '@app/interactors/settings/appearance.interactor';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterOutlet,
  UrlSerializer,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { isReturnNavigation, ScrollMemory } from './scroll-memory';

/** The primary navigation destinations, in the order they appear in the bottom bar. */
const DESTINATIONS = [
  { tab: 'today', label: 'Heute', link: '/today' },
  { tab: 'calendar', label: 'Kalender', link: '/calendar' },
  { tab: 'content', label: 'Inhalte', link: '/content' },
] as const;

type Tab = (typeof DESTINATIONS)[number]['tab'];

/**
 * App shell: the routed page plus the bottom navigation.
 *
 * Which destination is active - and whether the bottom navigation is shown at all - is derived
 * from the deepest activated route's `data.tab`. A route that declares a tab is a primary
 * destination; a route without one is a focused screen (detail, creation, settings) and the bottom
 * navigation stays hidden, so the focused screen owns the whole viewport.
 */
@Component({
  selector: 'app-main-navigation',
  // Component hosts are unknown elements and therefore inline by default.
  host: { class: 'block' },
  imports: [RouterOutlet, RouterLink, LucideSun, LucideCalendarDays, LucideBookOpen],
  templateUrl: './main-navigation.scaffold.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainNavigationScaffold {
  private readonly router = inject(Router);
  private readonly pageFocus = inject(PageFocus);
  private readonly motionReduced = inject(AppearanceInteractor).motionReduced;
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  /** Drives the focused-field reveal below - see the effect in the constructor. */
  private readonly keyboard = inject(KeyboardVisibility);

  /** The scroll region itself, one of the two places a focused field is revealed in. */
  private readonly scrollRegion = viewChild<ElementRef<HTMLElement>>('scrollRegion');

  /** The tab of the previous navigation, used to tell a tab switch from any other navigation. */
  private previousTab: Tab | null = null;

  /** The screen of the previous navigation, used to tell a new screen from a query change. */
  private previousScreen: string | null = null;

  private readonly scrollMemory = new ScrollMemory(inject(UrlSerializer));

  protected readonly destinations = DESTINATIONS;

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentTab()),
    ),
    { initialValue: null },
  );

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.leaveScreen();
      } else if (event instanceof NavigationEnd) {
        this.handleNavigation(event);
      }
    });

    // The shell does not resize for the keyboard; the scroll region and the sheet body pad
    // themselves by the part it covers instead (keyboard-visibility.ts). The field is focused before
    // that padding exists, though, so the platform's own reveal has nothing to scroll into yet -
    // once the keyboard is announced, the focused field is brought clear of it here. `nearest` with
    // the padded `scroll-padding-bottom` moves it only as far as needed, and not at all if it is
    // already visible. The inset is read too, so a keyboard that changes height reveals again.
    effect(() => {
      this.keyboard.inset();
      if (!this.keyboard.visible()) {
        return;
      }

      const field = this.document.activeElement;
      if (!(field instanceof HTMLElement)) {
        return;
      }
      const region = this.scrollRegion()?.nativeElement;
      const isInScrollRegion = region !== undefined && region.contains(field);
      if (!isInScrollRegion && field.closest('.rk-sheet-body') === null) {
        return;
      }

      requestAnimationFrame(() => field.scrollIntoView({ block: 'nearest' }));
    });
  }

  /** Remembers how far the screen being left was scrolled, in case the user comes back to it. */
  private leaveScreen(): void {
    this.scrollMemory.stop();
    const region = this.scrollRegion()?.nativeElement;
    if (region !== undefined) {
      this.scrollMemory.save(this.router.url, region.scrollTop);
    }
  }

  /**
   * Decide what happens to focus and to the scroll position once the new screen has rendered.
   *
   * Moving between two primary destinations means the user is operating the bottom navigation, so
   * focus stays where it is and the new page is only announced. Every other navigation - opening a
   * focused screen, closing one, or the initial load - replaces the context entirely, so focus
   * moves to the new screen's title.
   *
   * There is one scroll region for every screen, so it would otherwise keep the previous screen's
   * offset. A screen being returned to - closed back to, switched back to in the bottom
   * navigation, or reached with the browser's back button on the web - comes back where the user
   * left it; a screen being opened starts at the top. A navigation that only changes the query
   * string (another calendar day, the other content area) stays on the same screen and leaves the
   * scroll position alone.
   */
  private handleNavigation(event: NavigationEnd): void {
    const previousTab = this.previousTab;
    const currentTab = this.currentTab();
    this.previousTab = currentTab;

    const previousScreen = this.previousScreen;
    const currentScreen = this.scrollMemory.screenOf(event.urlAfterRedirects);
    this.previousScreen = currentScreen;

    const isTabSwitch = previousTab !== null && currentTab !== null;
    const navigation = this.router.currentNavigation();
    const isReturn =
      isTabSwitch ||
      navigation?.trigger === 'popstate' ||
      isReturnNavigation(navigation?.extras.info);

    afterNextRender(
      () => {
        if (isTabSwitch) {
          this.pageFocus.announcePageHeading();
        } else {
          this.pageFocus.focusPageHeading();
        }

        const region = this.scrollRegion()?.nativeElement;
        if (region === undefined || previousScreen === currentScreen) {
          return;
        }
        if (isReturn) {
          this.scrollMemory.restore(region, event.urlAfterRedirects);
        } else {
          region.scrollTop = 0;
        }
      },
      { injector: this.injector },
    );
  }

  /**
   * Tapping the active destination again scrolls its screen back to the top.
   *
   * No `preventDefault()`: the active destination's link keeps the current query parameters (see
   * the template), so it points at the URL that is already showing and the router ignores it. A
   * plain `/calendar` would navigate away from `/calendar?view=month` to the week view, and the
   * screen would jump instead of scrolling.
   */
  protected handleTabActivated(tab: Tab): void {
    if (tab !== this.activeTab()) {
      return;
    }

    this.scrollMemory.stop();
    this.scrollRegion()?.nativeElement.scrollTo({ top: 0, behavior: this.scrollBehavior() });
  }

  /**
   * Animated unless motion is reduced. The CSS in `base.css` cannot decide this for us: it governs
   * `scroll-behavior`, which a programmatic `scrollTo` with an explicit `behavior` overrides, so
   * `AppearanceInteractor.motionReduced` resolves the same two conditions in code - the in-app
   * override first, the device setting when the app is following it.
   */
  private scrollBehavior(): ScrollBehavior {
    return this.motionReduced() ? 'auto' : 'smooth';
  }

  private currentTab(): Tab | null {
    // Read the router's own snapshot rather than the injected ActivatedRoute: this component is
    // constructed in the middle of the first navigation, when the child routes it is being
    // activated for do not have a snapshot yet.
    let snapshot: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
    while (snapshot.firstChild !== null) {
      snapshot = snapshot.firstChild;
    }

    const tab: unknown = snapshot.data['tab'];
    return DESTINATIONS.some((destination) => destination.tab === tab) ? (tab as Tab) : null;
  }
}
