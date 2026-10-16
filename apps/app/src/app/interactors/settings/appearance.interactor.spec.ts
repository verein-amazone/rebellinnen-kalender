import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SystemDarkMode } from '@app/cross-cutting/infrastructure/system-dark-mode';

import { AppearanceInteractor } from './appearance.interactor';

class FakeSystemDarkMode {
  readonly dark = signal(false);
}

function setup(): { interactor: AppearanceInteractor; systemDarkMode: FakeSystemDarkMode } {
  localStorage.clear();
  TestBed.resetTestingModule();

  const systemDarkMode = new FakeSystemDarkMode();
  TestBed.configureTestingModule({
    providers: [{ provide: SystemDarkMode, useValue: systemDarkMode }],
  });

  return { interactor: TestBed.inject(AppearanceInteractor), systemDarkMode };
}

describe('AppearanceInteractor', () => {
  it('shows an explicitly selected palette whatever the device appearance', () => {
    const { interactor, systemDarkMode } = setup();

    interactor.selectTheme('lila');
    systemDarkMode.dark.set(true);

    expect(interactor.palette()).toBe('lila');
  });

  it('follows the device between Amazone and Mitternacht on the system theme', () => {
    const { interactor, systemDarkMode } = setup();

    interactor.selectTheme('system');
    expect(interactor.palette()).toBe('amazone');

    systemDarkMode.dark.set(true);
    expect(interactor.palette()).toBe('nacht');

    systemDarkMode.dark.set(false);
    expect(interactor.palette()).toBe('amazone');
  });

  it('keeps Amazone as the default, even on a device in dark mode', () => {
    const { interactor, systemDarkMode } = setup();

    systemDarkMode.dark.set(true);

    expect(interactor.theme()).toBe('amazone');
    expect(interactor.palette()).toBe('amazone');
  });

  it('previews both halves of the system theme and one palette for every other option', () => {
    const { interactor } = setup();

    expect(interactor.palettesOf('system')).toEqual(['amazone', 'nacht']);
    expect(interactor.palettesOf('warm')).toEqual(['warm']);
  });

  it('labels the system theme like the other device-following settings', () => {
    const { interactor } = setup();

    interactor.selectTheme('system');

    expect(interactor.themeLabel()).toBe('Systemeinstellung');
  });
});
