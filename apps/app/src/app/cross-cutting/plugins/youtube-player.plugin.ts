import { InjectionToken } from '@angular/core';
import {
  YoutubePlayer,
  type CreatePlayerOptions,
  type CreatePlayerResult,
  type PauseOptions,
  type PlayerErrorEvent,
  type RemovePlayerOptions,
  type SetPlayerFrameOptions,
} from '@capawesome/capacitor-youtube-player';

/** A listener registration the wrapper removes again when the player closes. */
export interface YoutubePlayerListenerHandle {
  remove(): Promise<void>;
}

/** The slice of the YouTube player plugin this app uses. */
export interface YoutubePlayerPlugin {
  createPlayer(options: CreatePlayerOptions): Promise<CreatePlayerResult>;
  setPlayerFrame(options: SetPlayerFrameOptions): Promise<void>;
  pause(options: PauseOptions): Promise<void>;
  removePlayer(options: RemovePlayerOptions): Promise<void>;
  addPlayerErrorListener(
    listener: (event: PlayerErrorEvent) => void,
  ): Promise<YoutubePlayerListenerHandle>;
}

/**
 * The native YouTube player (`@capawesome/capacitor-youtube-player`). See ./README.md for why it is
 * behind a token, and why it is a plain object rather than the plugin proxy.
 */
export const YOUTUBE_PLAYER_PLUGIN = new InjectionToken<YoutubePlayerPlugin>(
  'YOUTUBE_PLAYER_PLUGIN',
  {
    providedIn: 'root',
    factory: () => ({
      createPlayer: (options) => YoutubePlayer.createPlayer(options),
      setPlayerFrame: (options) => YoutubePlayer.setPlayerFrame(options),
      pause: (options) => YoutubePlayer.pause(options),
      removePlayer: (options) => YoutubePlayer.removePlayer(options),
      addPlayerErrorListener: (listener) => YoutubePlayer.addListener('playerError', listener),
    }),
  },
);
