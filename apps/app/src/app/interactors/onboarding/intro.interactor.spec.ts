import { TestBed } from '@angular/core/testing';

import { IntroInteractor } from './intro.interactor';

describe('IntroInteractor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('has not been seen on a fresh install', () => {
    expect(TestBed.inject(IntroInteractor).hasSeen()).toBe(false);
  });

  it('remembers once it was seen, and keeps the first time', () => {
    const intro = TestBed.inject(IntroInteractor);
    intro.markSeen();
    const first = localStorage.getItem('rk.intro');

    intro.markSeen();

    expect(intro.hasSeen()).toBe(true);
    expect(localStorage.getItem('rk.intro')).toBe(first);
  });

  it('remembers the step reached only while the introduction is unfinished', () => {
    const intro = TestBed.inject(IntroInteractor);
    intro.rememberStep(2);
    expect(intro.resumeStep()).toBe(2);

    intro.markSeen();
    intro.rememberStep(4);

    expect(intro.resumeStep()).toBe(2);
  });

  it('shows the introduction again from the start after a reset', () => {
    const intro = TestBed.inject(IntroInteractor);
    intro.rememberStep(3);
    intro.markSeen();

    intro.reset();

    expect(intro.hasSeen()).toBe(false);
    expect(intro.resumeStep()).toBe(1);
  });
});
