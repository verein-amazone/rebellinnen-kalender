import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { ServiceWorkerUpdates } from './service-worker-updates';

@Component({ template: '' })
class Screen {}

class FakeSwUpdate {
  isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
}

const VERSION_READY: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
};

function setup(enabled = true) {
  const updates = new FakeSwUpdate();
  updates.isEnabled = enabled;
  const reload = vi.fn();
  Object.defineProperty(globalThis.window, 'location', {
    configurable: true,
    value: { ...globalThis.window.location, reload },
  });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'today', component: Screen },
        { path: 'calendar', component: Screen },
      ]),
      { provide: SwUpdate, useValue: updates },
    ],
  });
  TestBed.inject(ServiceWorkerUpdates);

  return { updates, reload, navigate: (url: string) => TestBed.inject(Router).navigateByUrl(url) };
}

describe('ServiceWorkerUpdates', () => {
  it('reloads into a ready version on the next navigation, not in the middle of a screen', async () => {
    const { updates, reload, navigate } = setup();
    await navigate('/today');

    updates.versionUpdates.next(VERSION_READY);
    expect(reload).not.toHaveBeenCalled();

    await navigate('/calendar');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('ignores the worker only looking for or downloading a version', async () => {
    const { updates, reload, navigate } = setup();

    updates.versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    await navigate('/calendar');

    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads straight away when the worker can no longer serve this version', () => {
    const { updates, reload } = setup();

    updates.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'cache evicted' });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a service worker', async () => {
    const { updates, reload, navigate } = setup(false);

    updates.versionUpdates.next(VERSION_READY);
    updates.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'cache evicted' });
    await navigate('/calendar');

    expect(reload).not.toHaveBeenCalled();
  });
});
