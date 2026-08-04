import {
  ApplicationConfig,
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
  ],
};
