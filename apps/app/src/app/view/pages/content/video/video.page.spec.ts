import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import {
  NativeVideoPlayer,
  type VideoPlayerError,
  type VideoPlayerFrame,
} from '@app/cross-cutting/infrastructure/native-video-player';
import type { ContentItemView, VideoView } from '@app/interactors/daily-content/content-item.vm';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';

import { ContentVideoPage } from './video.page';

const VIDEO: VideoView = { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' };

function item(overrides: Partial<ContentItemView> = {}): ContentItemView {
  return {
    id: 'wi-301',
    kind: 'wissensimpulse',
    title: 'body rEVOLution!',
    teaser: '',
    bodyMarkdown: 'Text',
    imagePath: null,
    imageAlt: null,
    imageAttribution: null,
    sourceLabel: null,
    sourceUrl: null,
    relatedSources: [],
    video: VIDEO,
    supportServiceIds: null,
    ...overrides,
  };
}

class FakeNativeVideoPlayer {
  available = true;
  opened: { videoId: string; frame: VideoPlayerFrame }[] = [];
  closed = 0;
  failOpen = false;
  onError: ((error: VideoPlayerError) => void) | null = null;

  open(videoId: string, frame: VideoPlayerFrame, onError: (error: VideoPlayerError) => void) {
    if (this.failOpen) {
      return Promise.reject(new Error('no player'));
    }
    this.opened.push({ videoId, frame });
    this.onError = onError;
    return Promise.resolve({
      setFrame: () => undefined,
      close: () => {
        this.closed += 1;
      },
    });
  }
}

async function setup(
  config: {
    item?: ContentItemView | null;
    native?: boolean;
    failOpen?: boolean;
    online?: boolean;
  } = {},
) {
  const player = new FakeNativeVideoPlayer();
  player.available = config.native ?? true;
  player.failOpen = config.failOpen ?? false;
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(config.online ?? true);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: NativeVideoPlayer, useValue: player },
      {
        provide: ContentItemsInteractor,
        useValue: {
          findById: () => Promise.resolve(config.item === undefined ? item() : config.item),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(ContentVideoPage);
  fixture.componentRef.setInput('id', 'wi-301');
  await fixture.whenStable();
  // The native player opens after the stage has rendered and is created asynchronously.
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();

  return { fixture, player, element: fixture.nativeElement as HTMLElement };
}

/** jsdom has no ResizeObserver; the page only needs one to exist. */
class StubResizeObserver {
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
}

describe('ContentVideoPage', () => {
  beforeEach(() => vi.stubGlobal('ResizeObserver', StubResizeObserver));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens the native player over the stage on a phone, framing nothing itself', async () => {
    const { player, element } = await setup();

    expect(player.opened.map((entry) => entry.videoId)).toEqual(['teTZq72DAlM']);
    expect(element.querySelector('iframe')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('body rEVOLution!');
  });

  it('frames the cookie-less embed on the web', async () => {
    const { player, element } = await setup({ native: false });

    expect(player.opened).toEqual([]);
    const frame = element.querySelector('iframe');
    expect(frame?.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/teTZq72DAlM\?/);
    expect(frame?.title).toBe('YouTube-Video: body rEVOLution!');
  });

  it('closes the native player when the screen goes, and as soon as a navigation starts', async () => {
    const { fixture, player } = await setup();

    await TestBed.inject(Router).navigateByUrl('/');
    expect(player.closed).toBe(1);

    fixture.destroy();
    expect(player.closed).toBe(1);
  });

  it('replaces the player by an explanation when the video is gone', async () => {
    const { fixture, player, element } = await setup();

    player.onError?.('unavailable');
    await fixture.whenStable();

    expect(player.closed).toBe(1);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('nicht mehr verfügbar');
  });

  it('explains when the player cannot be opened', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { element } = await setup({ failOpen: true });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'kann gerade nicht abgespielt werden',
    );
  });

  it('does not open the player while offline, and says why', async () => {
    const { player, element } = await setup({ online: false });

    expect(player.opened).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Du bist offline');
  });

  it('always offers the video on YouTube itself', async () => {
    const { element } = await setup();

    expect(element.querySelector<HTMLAnchorElement>('a[target="_blank"]')?.href).toBe(
      'https://www.youtube.com/watch?v=teTZq72DAlM',
    );
  });

  it('says so for an item without a video', async () => {
    const { player, element } = await setup({ item: item({ video: null }) });

    expect(player.opened).toEqual([]);
    expect(element.textContent).toContain('Dieses Video ist nicht verfügbar.');
  });
});
