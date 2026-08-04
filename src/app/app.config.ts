import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Component input binding lets pages receive route parameters as signal inputs.
      withComponentInputBinding(),
      // Page transitions. The animation itself is defined in src/styles/base.css, which also
      // disables it under the reduced-motion setting.
      withViewTransitions({ skipInitialTransition: true }),
    ),
  ],
};
