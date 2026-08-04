import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideBookOpen, LucideCalendarDays, LucideSun } from '@lucide/angular';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

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
 * Which destination is active — and whether the bottom navigation is shown at all — is derived
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

  protected readonly destinations = DESTINATIONS;

  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.currentTab()),
    ),
    { initialValue: null },
  );

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
