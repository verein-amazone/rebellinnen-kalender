import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
  type RouterFeatures,
} from '@angular/router';

import { supportsViewTransitions } from '@app/cross-cutting/infrastructure/device-platform';
import { SystemTextScale } from '@app/cross-cutting/infrastructure/system-text-scale';
import { routes } from './app.routes';

const routerFeatures: RouterFeatures[] = [
  // Component input binding lets pages receive route parameters as signal inputs.
  withComponentInputBinding(),
];

if (supportsViewTransitions()) {
  // Page transitions. The animation itself is defined in src/styles/base.css, which also disables
  // it under the reduced-motion setting.
  routerFeatures.push(withViewTransitions({ skipInitialTransition: true }));
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, ...routerFeatures),
    // Awaited on purpose: the OS text scale has to be known before the first paint, or the app
    // renders at the wrong size for a frame. It also re-applies Android's `textZoom` reset, which
    // does not survive a restart.
    provideAppInitializer(() => inject(SystemTextScale).initialize()),
  ],
};
