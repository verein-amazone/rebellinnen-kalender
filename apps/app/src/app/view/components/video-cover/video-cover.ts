import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlay, LucideSquarePlay } from '@lucide/angular';

import type { VideoView } from '@app/interactors/daily-content/content-item.vm';

import { isYoutubeId, youtubeWatchUrl } from './youtube';

let nextId = 0;

/**
 * A content item's video before it plays: the item's own picture - a local file - with a play
 * button over it, so opening an item sends nothing to YouTube.
 *
 * The notice under it says what playing does and links the privacy policy. The tap is the consent,
 * every time; nothing about it is stored. `playRequested` then asks the screen to open the video,
 * which plays on a screen of its own (`ContentVideoPage`).
 *
 * „Auf YouTube ansehen“ stays next to it: a tap path to the video that works even where the player
 * does not.
 */
@Component({
  selector: 'app-video-cover',
  host: { class: 'block' },
  imports: [RouterLink, LucidePlay, LucideSquarePlay],
  templateUrl: './video-cover.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoCover {
  readonly video = input.required<VideoView>();
  /** The content item's title, for the play button's accessible name. */
  readonly title = input.required<string>();
  /** The item's picture, the cover until the video plays. */
  readonly posterPath = input<string | null>(null);
  /** What the picture shows, read with the play button since the picture itself is decoration. */
  readonly posterAlt = input<string | null>(null);
  /** Where the privacy policy's back action returns to: the screen this cover is on. */
  readonly returnTo = input<string | null>(null);

  /** The user asked for the video, and the device is online. */
  readonly playRequested = output<void>();

  private readonly document = inject(DOCUMENT);

  protected readonly noticeId = `app-video-cover-notice-${nextId++}`;
  protected readonly offline = signal(false);
  protected readonly playable = computed(() => isYoutubeId(this.video().id));
  protected readonly watchUrl = computed(() => youtubeWatchUrl(this.video()));

  protected requestPlay(): void {
    // Without a connection the player would only show an error. The status says why nothing
    // happens; a later tap tries again.
    if (this.document.defaultView?.navigator.onLine === false) {
      this.offline.set(true);
      return;
    }

    this.offline.set(false);
    this.playRequested.emit();
  }
}
