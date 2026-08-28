import { inject, Injectable } from '@angular/core';

import { EMOJI_PICKER_PLUGIN } from '@app/cross-cutting/plugins/emoji-picker.plugin';

/**
 * The emoji-picker boundary, wrapping `@independo/capacitor-emoji-picker` (see
 * `../plugins/emoji-picker.plugin.ts`).
 *
 * The plugin presents its own native or web picker UI (categories, search, everything); this
 * wrapper only forwards the result as a plain string or `null`, so no plugin type reaches the
 * interactor above it.
 */
@Injectable({ providedIn: 'root' })
export class NativeEmojiPicker {
  private readonly plugin = inject(EMOJI_PICKER_PLUGIN);

  /** Resolves with the picked emoji, or `null` when the user dismissed the picker. */
  async pickEmoji(): Promise<string | null> {
    const { emoji } = await this.plugin.present();
    return emoji;
  }
}
