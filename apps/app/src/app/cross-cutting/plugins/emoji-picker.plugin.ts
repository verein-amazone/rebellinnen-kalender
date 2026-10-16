import { InjectionToken } from '@angular/core';
import { EmojiPicker } from '@independo/capacitor-emoji-picker';

/** The emoji-picker plugin. See ./README.md for why it is behind a token. */
export const EMOJI_PICKER_PLUGIN = new InjectionToken<typeof EmojiPicker>('EMOJI_PICKER_PLUGIN', {
  providedIn: 'root',
  factory: () => EmojiPicker,
});
