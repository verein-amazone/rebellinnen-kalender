import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LocalDay } from '@app/cross-cutting/infrastructure/local-day';
import { ProfileInteractor } from '@app/interactors/settings/profile.interactor';

import { TodayGreetingBlock } from './today-greeting.block';

class FakeProfileInteractor {
  name = signal<string | null>(null);
  emoji = signal('⭐');
  pickEmojiCalls = 0;

  async pickEmoji(): Promise<void> {
    this.pickEmojiCalls++;
    this.emoji.set('🌻');
  }
}

function setup(hour: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 11, hour, 0, 0));

  TestBed.resetTestingModule();
  const profile = new FakeProfileInteractor();
  TestBed.configureTestingModule({
    providers: [
      { provide: ProfileInteractor, useValue: profile },
      { provide: LocalDay, useValue: { day: signal('2026-08-11').asReadonly() } },
    ],
  });

  const fixture = TestBed.createComponent(TodayGreetingBlock);
  fixture.detectChanges();

  return { element: fixture.nativeElement as HTMLElement, profile, fixture };
}

describe('TodayGreetingBlock', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the morning greeting before noon, as the screen's heading", () => {
    const { element } = setup(9);

    // The greeting is the Today page's `h1`: it is what `PageFocus` focuses and announces.
    expect(element.querySelector('h1')?.textContent).toContain('Guten Morgen');
  });

  it('shows the evening greeting after 18:00', () => {
    const { element } = setup(19);

    expect(element.textContent).toContain('Guten Abend');
  });

  it('includes the stored name in the greeting', () => {
    const { element, profile, fixture } = setup(9);
    profile.name.set('Nina');
    fixture.detectChanges();

    expect(element.querySelector('h1')?.textContent).toContain('Nina');
  });

  it('stays usable without a name', () => {
    const { element } = setup(9);

    expect(element.textContent).toContain('Guten Morgen');
  });

  it('shows the current emoji outside the heading, so it is not announced as part of it', () => {
    const { element } = setup(9);

    expect(element.textContent).toContain('⭐');
    expect(element.querySelector('h1')?.textContent).not.toContain('⭐');
  });

  it('opens the emoji picker when the emoji button is tapped', () => {
    const { element, profile } = setup(9);

    const button = element.querySelector('button');
    button?.click();

    expect(profile.pickEmojiCalls).toBe(1);
  });
});
