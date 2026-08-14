import { InjectionToken } from '@angular/core';
import { EmojiPicker } from '@independo/capacitor-emoji-picker';

/**
 * The emoji-picker plugin behind a token, so the gateway spec can substitute a hand-written stub
 * and the plugin never has to exist under jsdom.
 */
export const EMOJI_PICKER_PLUGIN = new InjectionToken<typeof EmojiPicker>('EMOJI_PICKER_PLUGIN', {
  providedIn: 'root',
  factory: () => EmojiPicker,
});
