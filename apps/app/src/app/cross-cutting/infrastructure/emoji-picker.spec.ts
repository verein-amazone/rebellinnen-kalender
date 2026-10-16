import { TestBed } from '@angular/core/testing';
import type { EmojiPicker } from '@independo/capacitor-emoji-picker';

import { EMOJI_PICKER_PLUGIN } from '@app/cross-cutting/plugins/emoji-picker.plugin';
import { NativeEmojiPicker } from './emoji-picker';

function setup(plugin: Partial<typeof EmojiPicker>): NativeEmojiPicker {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EMOJI_PICKER_PLUGIN, useValue: plugin }],
  });

  return TestBed.inject(NativeEmojiPicker);
}

describe('NativeEmojiPicker', () => {
  it('resolves with the picked emoji', async () => {
    const gateway = setup({ present: async () => ({ emoji: '🌻' }) });

    await expect(gateway.pickEmoji()).resolves.toBe('🌻');
  });

  it('resolves with null when the user dismisses without choosing', async () => {
    const gateway = setup({ present: async () => ({ emoji: null }) });

    await expect(gateway.pickEmoji()).resolves.toBeNull();
  });
});
