import { inject, Injectable } from '@angular/core';

import { DevicePlatformService } from '@app/cross-cutting/infrastructure/device-platform';
import { YOUTUBE_PLAYER_PLUGIN } from '@app/cross-cutting/plugins/youtube-player.plugin';

/** Where the player sits, in CSS pixels relative to the viewport - an element's client rect. */
export interface VideoPlayerFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A playing video: moved with its placeholder, and closed when the screen goes. */
export interface VideoPlayerHandle {
  setFrame(frame: VideoPlayerFrame): void;
  close(): void;
}

/**
 * Why a video does not play: it is gone or private (`unavailable`), or anything else went wrong
 * (`failed`). Declared here rather than taken from the plugin, whose types stay in `../plugins/`.
 */
export type VideoPlayerError = 'unavailable' | 'failed';

/** The plugin rejects a frame below this size, in either direction. */
export const MIN_PLAYER_SIZE = 200;

let nextId = 0;

/**
 * YouTube's player as a native view, wrapping `@capawesome/capacitor-youtube-player` (see
 * `../plugins/youtube-player.plugin.ts`).
 *
 * Native because the WebView cannot frame YouTube itself on iOS: from `capacitor://localhost` it
 * sends no referrer, and YouTube refuses to play with "Error 153". The plugin's view loads the player
 * from an https origin instead. It is laid *over* the WebView at a frame the caller keeps in sync
 * with a placeholder element, and does not scroll with the page - which is why only the dedicated
 * video screen, which does not scroll, shows it.
 *
 * Android and iOS only. On the web `available` is false and the caller frames the player itself,
 * where an http(s) origin works.
 */
@Injectable({ providedIn: 'root' })
export class NativeVideoPlayer {
  private readonly plugin = inject(YOUTUBE_PLAYER_PLUGIN);

  readonly available = inject(DevicePlatformService).platform !== 'web';

  /**
   * Opens the player at `frame` and starts the video. Rejects when the player cannot be created;
   * an error while it plays is reported through `onError` instead.
   */
  async open(
    videoId: string,
    frame: VideoPlayerFrame,
    onError: (error: VideoPlayerError) => void,
  ): Promise<VideoPlayerHandle> {
    const id = `rk-video-${nextId++}`;
    const listener = await this.plugin.addPlayerErrorListener((event) => {
      if (event.id === id) {
        onError(
          event.code === 'video-not-found' || event.code === 'not-embeddable'
            ? 'unavailable'
            : 'failed',
        );
      }
    });

    try {
      await this.plugin.createPlayer({
        id,
        videoId,
        frame: toPluginFrame(frame),
        // The tap that opened the screen asked for the video, so it starts at once. Only the same
        // channel's videos are suggested at the end, and captions show where the video has them.
        options: { autoplay: true, rel: false, ccLoadPolicy: true },
      });
    } catch (error) {
      void listener.remove();
      throw error;
    }

    let closed = false;
    return {
      setFrame: (next) => {
        if (!closed) {
          void this.plugin
            .setPlayerFrame({ id, frame: toPluginFrame(next) })
            .catch(() => undefined);
        }
      },
      close: () => {
        if (closed) {
          return;
        }
        closed = true;
        void listener.remove();
        void this.plugin.removePlayer({ id }).catch(() => undefined);
      },
    };
  }
}

/** Rounded, and never below the plugin's minimum, which it would otherwise reject. */
function toPluginFrame(frame: VideoPlayerFrame): VideoPlayerFrame {
  return {
    x: Math.round(frame.x),
    y: Math.round(frame.y),
    width: Math.max(MIN_PLAYER_SIZE, Math.round(frame.width)),
    height: Math.max(MIN_PLAYER_SIZE, Math.round(frame.height)),
  };
}
