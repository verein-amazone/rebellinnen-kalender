import { computed, inject, Injectable } from '@angular/core';

import { NativeEmojiPicker } from '@app/cross-cutting/infrastructure/emoji-picker';
import { DEFAULT_PROFILE_PREFERENCES, NAME_MAX_LENGTH } from '@app/data/stores/profile-preferences';
import { ProfileStore } from '@app/data/stores/profile.store';

/**
 * Reading and changing the profile preferences: the name used in the Today greeting and the
 * personal emoji shown next to it. Opening the emoji picker lives here too, so the block that
 * triggers it never talks to `NativeEmojiPicker` directly.
 */
@Injectable({ providedIn: 'root' })
export class ProfileInteractor {
  private readonly store = inject(ProfileStore);
  private readonly emojiPicker = inject(NativeEmojiPicker);

  /** The name field's `maxlength` - exposed so views never import the data-layer constant. */
  readonly nameMaxLength = NAME_MAX_LENGTH;

  readonly name = computed(() => this.store.preferences().name);
  readonly emoji = computed(() => this.store.preferences().emoji);

  /** An empty or whitespace-only name is stored as no name, so the greeting drops it. */
  setName(name: string): void {
    const trimmed = name.trim().slice(0, NAME_MAX_LENGTH);
    this.store.update({ name: trimmed === '' ? null : trimmed });
  }

  /** Opens the picker; leaves the current emoji untouched when the user dismisses it. */
  async pickEmoji(): Promise<void> {
    const emoji = await this.emojiPicker.pickEmoji();
    if (emoji !== null) {
      this.store.update({ emoji });
    }
  }

  resetEmoji(): void {
    this.store.update({ emoji: DEFAULT_PROFILE_PREFERENCES.emoji });
  }
}
