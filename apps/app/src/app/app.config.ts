import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
  type RouterFeatures,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';

import { supportsViewTransitions } from '@app/cross-cutting/infrastructure/device-platform';
import { SystemTextScale } from '@app/cross-cutting/infrastructure/system-text-scale';
import { routes } from './app.routes';

// The UI language is German regardless of the device locale; dates format through Angular's own
// mechanism (`DatePipe` / `formatDate`), which needs the locale data registered up front.
registerLocaleData(localeDe);

const routerFeatures: RouterFeatures[] = [
  // Component input binding lets pages receive route parameters as signal inputs.
  withComponentInputBinding(),
  withPreloading(PreloadAllModules),
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
    { provide: LOCALE_ID, useValue: 'de' },
    provideRouter(routes, ...routerFeatures),
    // Awaited on purpose: the OS text scale has to be known before the first paint, or the app
    // renders at the wrong size for a frame. It also re-applies Android's `textZoom` reset, which
    // does not survive a restart.
    provideAppInitializer(() => inject(SystemTextScale).initialize()),
  ],
};
