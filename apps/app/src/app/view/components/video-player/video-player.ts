import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { LucidePlay, LucideSquarePlay } from '@lucide/angular';

import {
  NativeVideoPlayer,
  type VideoPlayerError,
  type VideoPlayerHandle,
} from '@app/cross-cutting/infrastructure/native-video-player';
import type { VideoView } from '@app/interactors/daily-content/content-item.vm';
import { InfoToggletip } from '@app/view/components/info-toggletip/info-toggletip';

import { isYoutubeId, youtubeEmbedUrl, youtubeWatchUrl } from './youtube';

/** Why the video does not play: the player's own reasons, or no connection to load it over. */
type PlaybackProblem = VideoPlayerError | 'offline';

let nextId = 0;

/**
 * A content item's video, in the place of its picture. Until it is tapped it is the item's own
 * picture - a local file - with a play button over it, so opening an item sends nothing to YouTube.
 * The tap is the consent, every time; nothing about it is stored. The info button next to
 * „Auf YouTube ansehen“ says what playing does and links the privacy policy.
 *
 * The video then plays right here. On the web the stage holds the cookie-less embed. On Android and
 * iOS the player is a native view laid over the page (`NativeVideoPlayer`), because the WebView
 * cannot frame YouTube itself on iOS. That view does not scroll with the page, so it follows the
 * stage on every scroll, and is parked - paused and out of sight - while anything of the page, such
 * as the sticky header, covers the stage, instead of being drawn on top of it.
 *
 * „Auf YouTube ansehen“ stays below it: a tap path to the video that works even where the player
 * does not.
 */
@Component({
  selector: 'app-video-player',
  host: { class: 'block' },
  imports: [RouterLink, LucidePlay, LucideSquarePlay, InfoToggletip],
  templateUrl: './video-player.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VideoPlayer {
  readonly video = input.required<VideoView>();
  /** The content item's title, for the play button's and the player's accessible names. */
  readonly title = input.required<string>();
  /** The item's picture, the cover until the video plays. */
  readonly posterPath = input<string | null>(null);
  /** What the picture shows, read with the play button since the picture itself is decoration. */
  readonly posterAlt = input<string | null>(null);
  /** Where the privacy policy's back action returns to: the screen this player is on. */
  readonly returnTo = input<string | null>(null);

  private readonly player = inject(NativeVideoPlayer);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly descriptionId = `app-video-player-description-${nextId++}`;
  protected readonly playable = computed(() => isYoutubeId(this.video().id));
  protected readonly portrait = computed(() => this.video().orientation === 'portrait');
  protected readonly watchUrl = computed(() => youtubeWatchUrl(this.video()));
  protected readonly native = this.player.available;

  /** The tap asked for the video: the stage replaces the cover. */
  protected readonly playing = signal(false);
  protected readonly problem = signal<PlaybackProblem | null>(null);
  /** The cover's tap found no connection; the cover stays and says why. */
  protected readonly offline = signal(false);

  /** The web's player: the cookie-less embed, trusted here because it is built from a checked id. */
  protected readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.native || !this.playing() ? null : youtubeEmbedUrl(this.video());
    return url === null ? null : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  private handle: VideoPlayerHandle | null = null;
  private stopFollowing: () => void = () => undefined;

  constructor() {
    // The router reuses the item screen for the next item: a new video starts as a cover again.
    effect(() => {
      this.video();
      untracked(() => this.reset());
    });

    // The native view is not part of the page: it has to go before the next screen shows, not after.
    const navigation = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.reset();
      }
    });
    inject(DestroyRef).onDestroy(() => {
      navigation.unsubscribe();
      this.closeNative();
    });
  }

  protected play(): void {
    // Without a connection the player would only show an error. The status says why nothing
    // happens; a later tap tries again.
    if (this.document.defaultView?.navigator.onLine === false) {
      this.offline.set(true);
      return;
    }

    this.offline.set(false);
    this.problem.set(null);
    this.playing.set(true);

    // After the stage has rendered: focus moves from the vanished button to it, and on the phone
    // platforms there is now a rect to lay the player over.
    const videoId = this.video().id;
    afterNextRender(
      () => {
        const stage = this.stage()?.nativeElement;
        if (stage === undefined) {
          return;
        }
        stage.focus({ preventScroll: true });
        if (this.native) {
          void this.openNative(videoId, stage);
        }
      },
      { injector: this.injector },
    );
  }

  private async openNative(videoId: string, stage: HTMLElement): Promise<void> {
    let handle: VideoPlayerHandle;
    try {
      handle = await this.player.open(videoId, stage.getBoundingClientRect(), (error) => {
        this.closeNative();
        this.problem.set(error);
      });
    } catch (error) {
      console.warn('Das Video konnte nicht geöffnet werden.', error);
      this.problem.set('failed');
      return;
    }

    // Left, or moved on to another video, while the player was being created.
    if (!this.playing() || this.video().id !== videoId) {
      handle.close();
      return;
    }
    this.handle = handle;
    this.followStage(stage);
  }

  /**
   * Keeps the native view on the stage, checked on every frame for as long as it plays: scrolling,
   * a growing text size, and a sheet or panel opening over the page all move or cover the stage
   * without one event that says so. Wherever the page covers the stage - the sticky header as it
   * scrolls under it, a sheet's backdrop - the view is parked rather than drawn over it, and comes
   * back, paused, once the stage is clear. The plugin is only called when something changed.
   */
  private followStage(stage: HTMLElement): void {
    const view = this.document.defaultView;
    if (view === null || this.handle === null) {
      return;
    }

    let last = '';
    let frame = 0;
    const check = () => {
      const rect = stage.getBoundingClientRect();
      const covered = this.covered(stage, rect, view.innerHeight);
      const key = covered
        ? 'parked'
        : [rect.x, rect.y, rect.width, rect.height].map(Math.round).join();
      if (key !== last) {
        last = key;
        if (covered) {
          this.handle?.park();
        } else {
          this.handle?.setFrame(rect);
        }
      }
      frame = view.requestAnimationFrame(check);
    };
    frame = view.requestAnimationFrame(check);

    this.stopFollowing = () => view.cancelAnimationFrame(frame);
  }

  /**
   * Whether anything is drawn over the stage, or its top has left the screen. Hit-tests the stage's
   * corners against the page, so it catches the sticky header and any other layer without knowing
   * about them; the native view itself is not part of the page and never hit. A bottom edge below
   * the screen is fine: the screen's own edge cuts the view off there.
   */
  private covered(stage: HTMLElement, rect: DOMRect, viewportHeight: number): boolean {
    if (rect.top < 0) {
      return true;
    }
    const inset = 2;
    const xs = [rect.left + inset, rect.right - inset];
    const ys = [rect.top + inset];
    if (rect.bottom - inset < viewportHeight) {
      ys.push(rect.bottom - inset);
    }
    return ys.some((y) =>
      xs.some((x) => {
        const hit = this.document.elementFromPoint(x, y);
        return hit === null || !stage.contains(hit);
      }),
    );
  }

  private reset(): void {
    this.closeNative();
    this.playing.set(false);
    this.problem.set(null);
    this.offline.set(false);
  }

  private closeNative(): void {
    this.stopFollowing();
    this.stopFollowing = () => undefined;
    this.handle?.close();
    this.handle = null;
  }
}
