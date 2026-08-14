import { TestBed } from '@angular/core/testing';
import type { EmojiPicker } from '@independo/capacitor-emoji-picker';

import { EMOJI_PICKER_PLUGIN } from './emoji-picker-plugin';
import { EmojiPickerGateway } from './emoji-picker.gateway';

function setup(plugin: Partial<typeof EmojiPicker>): EmojiPickerGateway {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: EMOJI_PICKER_PLUGIN, useValue: plugin }],
  });

  return TestBed.inject(EmojiPickerGateway);
}

describe('EmojiPickerGateway', () => {
  it('resolves with the picked emoji', async () => {
    const gateway = setup({ present: async () => ({ emoji: '🌻' }) });

    await expect(gateway.pickEmoji()).resolves.toBe('🌻');
  });

  it('resolves with null when the user dismisses without choosing', async () => {
    const gateway = setup({ present: async () => ({ emoji: null }) });

    await expect(gateway.pickEmoji()).resolves.toBeNull();
  });
});
