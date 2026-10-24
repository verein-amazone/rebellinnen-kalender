import { TestBed } from '@angular/core/testing';

import { YOUTUBE_PLAYER_PLUGIN } from '@app/cross-cutting/plugins/youtube-player.plugin';

import { DevicePlatformService } from './device-platform';
import { NativeVideoPlayer, type VideoPlayerError } from './native-video-player';

interface PlayerErrorEvent {
  readonly id: string;
  readonly code: string;
}

class StubYoutubePlayerPlugin {
  created: { id: string; videoId?: string; frame: unknown; options?: unknown }[] = [];
  frames: { id: string; frame: unknown }[] = [];
  removed: string[] = [];
  listenersRemoved = 0;
  failCreate = false;
  private listener: ((event: PlayerErrorEvent) => void) | null = null;

  createPlayer(options: { id: string; videoId?: string; frame: unknown; options?: unknown }) {
    if (this.failCreate) {
      return Promise.reject(new Error('no player'));
    }
    this.created.push(options);
    return Promise.resolve({ id: options.id });
  }

  setPlayerFrame(options: { id: string; frame: unknown }): Promise<void> {
    this.frames.push(options);
    return Promise.resolve();
  }

  removePlayer(options: { id: string }): Promise<void> {
    this.removed.push(options.id);
    return Promise.resolve();
  }

  addPlayerErrorListener(listener: (event: PlayerErrorEvent) => void) {
    this.listener = listener;
    return Promise.resolve({
      remove: () => {
        this.listenersRemoved += 1;
        return Promise.resolve();
      },
    });
  }

  fail(event: PlayerErrorEvent): void {
    this.listener?.(event);
  }
}

function setup(platform: 'ios' | 'android' | 'web' = 'ios') {
  const plugin = new StubYoutubePlayerPlugin();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: YOUTUBE_PLAYER_PLUGIN, useValue: plugin },
      { provide: DevicePlatformService, useValue: { platform } },
    ],
  });
  return { player: TestBed.inject(NativeVideoPlayer), plugin };
}

const FRAME = { x: 16.4, y: 120.6, width: 358, height: 201.2 };

describe('NativeVideoPlayer', () => {
  it('is available on the phone platforms only', () => {
    expect(setup('ios').player.available).toBe(true);
    expect(setup('android').player.available).toBe(true);
    expect(setup('web').player.available).toBe(false);
  });

  it('opens the video at once, at the rounded frame', async () => {
    const { player, plugin } = setup();

    await player.open('teTZq72DAlM', FRAME, () => undefined);

    expect(plugin.created).toEqual([
      expect.objectContaining({
        videoId: 'teTZq72DAlM',
        frame: { x: 16, y: 121, width: 358, height: 201 },
        options: { autoplay: true, rel: false, ccLoadPolicy: true },
      }),
    ]);
  });

  it('never hands the plugin a frame below its minimum size', async () => {
    const { player, plugin } = setup();

    const handle = await player.open(
      'teTZq72DAlM',
      { x: 0, y: 0, width: 150, height: 90 },
      () => undefined,
    );
    handle.setFrame({ x: 0, y: 10, width: 120, height: 199 });

    expect(plugin.created[0].frame).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(plugin.frames[0].frame).toEqual({ x: 0, y: 10, width: 200, height: 200 });
  });

  it('moves and closes its own player, and stops listening on close', async () => {
    const { player, plugin } = setup();

    const handle = await player.open('teTZq72DAlM', FRAME, () => undefined);
    const id = plugin.created[0].id;
    handle.setFrame({ x: 16, y: 300, width: 358, height: 201 });
    handle.close();
    handle.close();
    handle.setFrame({ x: 16, y: 400, width: 358, height: 201 });

    expect(plugin.frames).toEqual([{ id, frame: { x: 16, y: 300, width: 358, height: 201 } }]);
    expect(plugin.removed).toEqual([id]);
    expect(plugin.listenersRemoved).toBe(1);
  });

  it('reports a missing or non-embeddable video as unavailable, and anything else as failed', async () => {
    const { player, plugin } = setup();
    const errors: VideoPlayerError[] = [];

    await player.open('teTZq72DAlM', FRAME, (error) => errors.push(error));
    const id = plugin.created[0].id;
    plugin.fail({ id, code: 'video-not-found' });
    plugin.fail({ id, code: 'not-embeddable' });
    plugin.fail({ id, code: 'html5-error' });
    plugin.fail({ id: 'someone-else', code: 'unknown' });

    expect(errors).toEqual(['unavailable', 'unavailable', 'failed']);
  });

  it('rejects when the player cannot be created, without leaving its listener behind', async () => {
    const { player, plugin } = setup();
    plugin.failCreate = true;

    await expect(player.open('teTZq72DAlM', FRAME, () => undefined)).rejects.toThrow('no player');
    expect(plugin.listenersRemoved).toBe(1);
  });
});
