import { Routes } from '@angular/router';

import { firstLaunchGuard } from '@app/view/guards/first-launch.guard';
import { MainNavigationScaffold } from '@app/view/scaffolds/main-navigation/main-navigation.scaffold';

/**
 * One lazily loaded route group per page area. A group's routes live next to its pages in
 * `view/pages/<group>/<group>.routes.ts`.
 *
 * Routes that declare `data.tab` are primary destinations and show the bottom navigation; every
 * other route is a focused screen. See the main navigation scaffold.
 */
export const routes: Routes = [
  {
    path: '',
    component: MainNavigationScaffold,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      {
        path: 'today',
        canActivate: [firstLaunchGuard],
        loadChildren: () =>
          import('@app/view/pages/today/today.routes').then((m) => m.TODAY_ROUTES),
      },
      {
        path: 'calendar',
        loadChildren: () =>
          import('@app/view/pages/calendar/calendar.routes').then((m) => m.CALENDAR_ROUTES),
      },
      {
        path: 'content',
        loadChildren: () =>
          import('@app/view/pages/content/content.routes').then((m) => m.CONTENT_ROUTES),
      },
      {
        // A child of the scaffold like every other screen, so `PageFocus` finds its heading.
        path: 'intro/:step',
        title: 'Einführung',
        loadComponent: () =>
          import('@app/view/pages/onboarding/intro.page').then((m) => m.IntroPage),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@app/view/pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
