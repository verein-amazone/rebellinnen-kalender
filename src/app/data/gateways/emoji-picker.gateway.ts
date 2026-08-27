import { inject, Injectable } from '@angular/core';

import { EMOJI_PICKER_PLUGIN } from './emoji-picker-plugin';

/**
 * The emoji-picker boundary - the only importer of `@independo/capacitor-emoji-picker`.
 *
 * The plugin presents its own native or web picker UI (categories, search, everything); this
 * gateway only forwards the result as a plain string or `null`, so no plugin type reaches the
 * interactor above it.
 */
@Injectable({ providedIn: 'root' })
export class EmojiPickerGateway {
  private readonly plugin = inject(EMOJI_PICKER_PLUGIN);

  /** Resolves with the picked emoji, or `null` when the user dismissed the picker. */
  async pickEmoji(): Promise<string | null> {
    const { emoji } = await this.plugin.present();
    return emoji;
  }
}
