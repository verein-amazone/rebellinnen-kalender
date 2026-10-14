import { DOCUMENT, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { first, switchMap } from 'rxjs';

/**
 * Brings the web demo onto a new deployment. The service worker only registers in that build (see
 * `app.config.ts`); everywhere else this does nothing.
 *
 * The worker downloads a new version in the background but keeps serving the old one to the open
 * page, so without this a visitor would stay on it until every tab is closed. Once the new version
 * is ready, the next navigation reloads the page into it - between screens rather than in the
 * middle of one, so nothing half-typed is lost. A worker that can no longer serve the version the
 * page runs on reloads straight away.
 */
@Injectable({ providedIn: 'root' })
export class ServiceWorkerUpdates {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  constructor() {
    if (!this.updates?.isEnabled) {
      return;
    }

    this.updates.versionUpdates
      .pipe(
        first((event) => event.type === 'VERSION_READY'),
        switchMap(() => this.router.events),
        first((event) => event instanceof NavigationEnd),
      )
      .subscribe(() => this.reload());

    this.updates.unrecoverable.subscribe(() => this.reload());
  }

  private reload(): void {
    this.document.defaultView?.location.reload();
  }
}
