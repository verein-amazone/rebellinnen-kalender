import { TestBed } from '@angular/core/testing';

import { NativeEmojiPicker } from '@app/cross-cutting/infrastructure/emoji-picker';

import { ProfileInteractor } from './profile.interactor';

class FakeEmojiPicker {
  result: string | null = '🌻';

  pickEmoji(): Promise<string | null> {
    return Promise.resolve(this.result);
  }
}

function setup(): { interactor: ProfileInteractor; emojiPicker: FakeEmojiPicker } {
  localStorage.clear();
  TestBed.resetTestingModule();

  const emojiPicker = new FakeEmojiPicker();
  TestBed.configureTestingModule({
    providers: [{ provide: NativeEmojiPicker, useValue: emojiPicker }],
  });

  return { interactor: TestBed.inject(ProfileInteractor), emojiPicker };
}

describe('ProfileInteractor', () => {
  it('exposes the default name and emoji when nothing was ever set', () => {
    const { interactor } = setup();

    expect(interactor.name()).toBeNull();
    expect(interactor.emoji()).toBe('⭐');
  });

  it('trims and stores a new name', () => {
    const { interactor } = setup();

    interactor.setName('  Nina  ');

    expect(interactor.name()).toBe('Nina');
  });

  it('stores an empty name as no name', () => {
    const { interactor } = setup();

    interactor.setName('Nina');
    interactor.setName('   ');

    expect(interactor.name()).toBeNull();
  });

  it('stores the emoji the picker resolves with', async () => {
    const { interactor, emojiPicker } = setup();
    emojiPicker.result = '🌻';

    await interactor.pickEmoji();

    expect(interactor.emoji()).toBe('🌻');
  });

  it('keeps the current emoji when the picker is dismissed without a choice', async () => {
    const { interactor, emojiPicker } = setup();
    emojiPicker.result = null;

    await interactor.pickEmoji();

    expect(interactor.emoji()).toBe('⭐');
  });

  it('resets the emoji to the default', async () => {
    const { interactor, emojiPicker } = setup();
    emojiPicker.result = '🌻';
    await interactor.pickEmoji();

    interactor.resetEmoji();

    expect(interactor.emoji()).toBe('⭐');
  });
});
