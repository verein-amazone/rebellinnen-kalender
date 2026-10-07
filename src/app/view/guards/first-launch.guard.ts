import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';

/**
 * Sends a first launch to the introduction (#82) instead of the Today screen - on the step it was
 * left on, when an earlier launch was interrupted. Only guards Today, where every launch lands: a
 * deep link into the app is a deliberate destination and is never diverted.
 */
export const firstLaunchGuard: CanActivateFn = () => {
  const intro = inject(IntroInteractor);
  return intro.hasSeen() || inject(Router).createUrlTree(['/intro', intro.resumeStep()]);
};
