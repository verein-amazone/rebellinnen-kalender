import { TestBed } from '@angular/core/testing';

import { AppearanceInteractor } from './appearance.interactor';

function setup(): AppearanceInteractor {
  localStorage.clear();
  TestBed.resetTestingModule();
  return TestBed.inject(AppearanceInteractor);
}

describe('AppearanceInteractor', () => {
  it('keeps Amazone („Strong“) as the default theme', () => {
    const interactor = setup();

    expect(interactor.theme()).toBe('amazone');
    expect(interactor.themeLabel()).toBe('Strong');
  });

  it('lists the themes under the names Verein Amazone gave them', () => {
    const interactor = setup();

    expect(interactor.themeOptions.map((option) => [option.id, option.label])).toEqual([
      ['amazone', 'Strong'],
      ['nacht', 'Dark'],
      ['lila', 'Soft'],
    ]);
  });

  it('names the selected theme for the settings overview', () => {
    const interactor = setup();

    interactor.selectTheme('lila');

    expect(interactor.themeLabel()).toBe('Soft');
  });
});
