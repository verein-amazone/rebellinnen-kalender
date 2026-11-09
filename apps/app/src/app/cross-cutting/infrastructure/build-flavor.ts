import { Injectable } from '@angular/core';

/**
 * Whether this is the web demo build: `true` in the `demo` build configuration, `false` everywhere
 * else (`define` in angular.json).
 */
declare const demoBuild: boolean;

/**
 * Whether this bundle is the web demo published at https://rebellinnen.amazone.or.at/demo/ - a
 * browser build for looking at the app, not for using it. The phone apps, `ng serve` and the
 * Playwright suite are not.
 *
 * A plain function rather than an injectable service because the router configuration needs it
 * while the application providers are being assembled, before an injector exists.
 */
export function isDemoBuild(): boolean {
  return demoBuild;
}

/**
 * The injectable form of `isDemoBuild()`, for components that branch on it and need a fake in
 * tests - a build-time constant can't be substituted through `TestBed`, unlike a provider.
 */
@Injectable({ providedIn: 'root' })
export class BuildFlavor {
  readonly demo: boolean = isDemoBuild();
}
