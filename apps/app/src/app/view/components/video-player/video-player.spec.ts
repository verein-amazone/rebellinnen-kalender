import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import {
  NativeVideoPlayer,
  type VideoPlayerError,
  type VideoPlayerFrame,
} from '@app/cross-cutting/infrastructure/native-video-player';
import type { VideoView } from '@app/interactors/daily-content/content-item.vm';

import { VideoPlayer } from './video-player';

const VIDEO: VideoView = { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' };

/** The native player as the component sees it: records what it is told, reports errors on demand. */
class FakeNativeVideoPlayer {
  available = true;
  opened: string[] = [];
  frames: VideoPlayerFrame[] = [];
  parks = 0;
  closes = 0;
  failOpen = false;
  private onError: ((error: VideoPlayerError) => void) | null = null;

  open(videoId: string, frame: VideoPlayerFrame, onError: (error: VideoPlayerError) => void) {
    if (this.failOpen) {
      return Promise.reject(new Error('no player'));
    }
    this.opened.push(videoId);
    this.frames.push(frame);
    this.onError = onError;
    return Promise.resolve({
      setFrame: (next: VideoPlayerFrame) => this.frames.push(next),
      park: () => (this.parks += 1),
      close: () => (this.closes += 1),
    });
  }

  fail(error: VideoPlayerError): void {
    this.onError?.(error);
  }
}

async function setup(
  config: { video?: VideoView; online?: boolean; native?: FakeNativeVideoPlayer } = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...(config.native ? [{ provide: NativeVideoPlayer, useValue: config.native }] : []),
    ],
  });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(config.online ?? true);

  const fixture = TestBed.createComponent(VideoPlayer);
  fixture.componentRef.setInput('video', config.video ?? VIDEO);
  fixture.componentRef.setInput('title', 'body rEVOLution!');
  fixture.componentRef.setInput('posterPath', '/content/images/body.webp');
  fixture.componentRef.setInput('posterAlt', 'Junge Frau, nah an der Kamera.');
  fixture.componentRef.setInput('returnTo', '/content/wi-301');
  const element = fixture.nativeElement as HTMLElement;
  document.body.appendChild(element);
  await fixture.whenStable();

  return {
    fixture,
    element,
    settle: () => fixture.whenStable(),
    button: () => element.querySelector<HTMLButtonElement>('.rk-video-poster'),
    stage: () => element.querySelector<HTMLElement>('.rk-video-frame'),
  };
}

/** Runs the queued animation frames, as the browser would on the next repaint. */
function runFrames(frames: FrameRequestCallback[]): void {
  for (const callback of frames.splice(0)) {
    callback(0);
  }
}

describe('VideoPlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('names the play button by its visible label first, then the item', async () => {
    const { button } = await setup();

    expect(button()?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Video abspielen: body rEVOLution!',
    );
  });

  it('shows the picture as decoration and reads its description with the button', async () => {
    const { element, button } = await setup();
    const description = element.querySelector(`#${button()?.getAttribute('aria-describedby')}`);

    expect(element.querySelector('button img')?.getAttribute('alt')).toBe('');
    expect(description?.textContent).toBe('Standbild: Junge Frau, nah an der Kamera.');
  });

  it('keeps the privacy notice behind an info button next to the YouTube link', async () => {
    const { element, settle } = await setup();
    const info = element.querySelector<HTMLButtonElement>('app-info-toggletip button')!;

    expect(info.getAttribute('aria-label')).toBe('Info zu YouTube-Videos');
    expect(element.textContent).not.toContain('Daten an Google');
    expect(info.closest('div')?.querySelector('a[target="_blank"]')).not.toBeNull();

    info.click();
    await settle();

    expect(element.querySelector('.rk-toggletip')?.textContent).toContain(
      'Daten an Google übertragen',
    );
    expect(
      element
        .querySelector<HTMLAnchorElement>('.rk-toggletip a[href^="/settings/privacy"]')
        ?.getAttribute('href'),
    ).toBe('/settings/privacy?returnTo=%2Fcontent%2Fwi-301');
  });

  it('plays the cookie-less embed right here on the web, and moves focus to it', async () => {
    const { element, button, stage, settle } = await setup();

    button()?.click();
    await settle();

    const iframe = element.querySelector('iframe');
    expect(button()).toBeNull();
    expect(iframe?.getAttribute('src')).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/teTZq72DAlM\?/,
    );
    expect(iframe?.getAttribute('title')).toBe('YouTube-Video: body rEVOLution!');
    expect(document.activeElement).toBe(stage());
  });

  it('says why nothing happens while offline, and keeps the cover', async () => {
    const { element, button, settle } = await setup({ online: false });

    button()?.click();
    await settle();

    expect(button()).not.toBeNull();
    expect(element.querySelector('iframe')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Du bist offline');
  });

  it('always offers the video on YouTube itself', async () => {
    const { element } = await setup();

    expect(element.querySelector<HTMLAnchorElement>('a[target="_blank"]')?.href).toBe(
      'https://www.youtube.com/watch?v=teTZq72DAlM',
    );
  });

  it('offers only the link, with the picture described, for an id that cannot be played', async () => {
    const { element, button } = await setup({ video: { ...VIDEO, id: 'not-an-id' } });

    expect(button()).toBeNull();
    expect(element.querySelector('app-info-toggletip')).toBeNull();
    expect(element.querySelector('img')?.getAttribute('alt')).toBe(
      'Junge Frau, nah an der Kamera.',
    );
    expect(element.querySelector('a[target="_blank"]')).not.toBeNull();
  });

  describe('on the phone platforms', () => {
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      frames = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', () => undefined);
    });

    async function startNative(native = new FakeNativeVideoPlayer()) {
      const view = await setup({ native });
      view.button()?.click();
      await view.settle();
      // Let the player's creation resolve.
      await Promise.resolve();
      await view.settle();
      return { ...view, native };
    }

    it('lays the native player over the stage instead of embedding it', async () => {
      const { element, native } = await startNative();

      expect(native.opened).toEqual(['teTZq72DAlM']);
      expect(element.querySelector('iframe')).toBeNull();
      // The picture stays behind the player, in view while it is parked.
      expect(element.querySelector('.rk-video-frame img')).not.toBeNull();
    });

    it('follows the stage while it is clear, and parks the player while it is covered', async () => {
      const { stage, native } = await startNative();
      const header = document.createElement('header');
      document.body.appendChild(header);
      let hit: Element = stage()!;
      // jsdom does no layout, so it has no hit-testing either.
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: () => hit,
      });
      let rect = new DOMRect(16, 120, 358, 201);
      vi.spyOn(stage()!, 'getBoundingClientRect').mockImplementation(() => rect);

      runFrames(frames);
      runFrames(frames);
      expect(native.frames.at(-1)).toEqual(rect);
      const followed = native.frames.length;

      rect = new DOMRect(16, 40, 358, 201);
      hit = header;
      runFrames(frames);
      runFrames(frames);
      expect(native.parks).toBe(1);
      expect(native.frames).toHaveLength(followed);

      hit = stage()!;
      runFrames(frames);
      expect(native.frames.at(-1)).toEqual(rect);
      Reflect.deleteProperty(document, 'elementFromPoint');
    });

    it('parks the player once the stage has scrolled off the top', async () => {
      const { stage, native } = await startNative();
      vi.spyOn(stage()!, 'getBoundingClientRect').mockReturnValue(new DOMRect(16, -50, 358, 201));

      runFrames(frames);

      expect(native.parks).toBe(1);
    });

    it('closes the player when the screen navigates away', async () => {
      const { native, button, settle } = await startNative();

      await TestBed.inject(Router)
        .navigateByUrl('/elsewhere')
        .catch(() => undefined);
      await settle();

      expect(native.closes).toBe(1);
      expect(button()).not.toBeNull();
    });

    it('closes the player and says so when the video is unavailable', async () => {
      const { element, native, settle } = await startNative();

      native.fail('unavailable');
      await settle();

      expect(native.closes).toBe(1);
      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'nicht mehr verfügbar',
      );
    });

    it('says so when the player cannot be created', async () => {
      const native = new FakeNativeVideoPlayer();
      native.failOpen = true;
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { element } = await startNative(native);

      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'kann gerade nicht abgespielt werden',
      );
    });
  });
});
