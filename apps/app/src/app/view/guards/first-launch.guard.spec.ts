import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type ActivatedRouteSnapshot } from '@angular/router';

import { IntroInteractor } from '@app/interactors/onboarding/intro.interactor';

import { firstLaunchGuard } from './first-launch.guard';

function runGuard(): ReturnType<typeof firstLaunchGuard> {
  return TestBed.runInInjectionContext(() =>
    firstLaunchGuard({} as ActivatedRouteSnapshot, { url: '/today', root: {} } as never),
  );
}

describe('firstLaunchGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('sends a first launch to the introduction', () => {
    const result = runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/intro/1');
  });

  it('resumes an interrupted introduction on the step it was left on', () => {
    TestBed.inject(IntroInteractor).rememberStep(3);

    const result = runGuard();

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/intro/3');
  });

  it('lets Today through once the introduction was seen', () => {
    TestBed.inject(IntroInteractor).markSeen();

    expect(runGuard()).toBe(true);
  });
});
