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
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { NavigationStart, Router } from '@angular/router';
import { LucideSquarePlay } from '@lucide/angular';

import { safeInAppUrl } from '@app/cross-cutting/helpers/in-app-url';
import { valueOr } from '@app/cross-cutting/helpers/resource-value';
import {
  NativeVideoPlayer,
  type VideoPlayerError,
  type VideoPlayerHandle,
} from '@app/cross-cutting/infrastructure/native-video-player';
import { ContentItemsInteractor } from '@app/interactors/daily-content/content-items.interactor';
import {
  isYoutubeId,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from '@app/view/components/video-cover/youtube';
import { FocusedScreenScaffold } from '@app/view/scaffolds/focused-screen/focused-screen.scaffold';

/** Why the video does not play: the player's own reasons, or no connection to load it over. */
type PlaybackProblem = VideoPlayerError | 'offline';

/**
 * A content item's video, playing. Reached only from the item's cover, whose tap is the
 * consent to load it.
 *
 * On Android and iOS the player is a native view laid over the page (`NativeVideoPlayer`): the
 * WebView cannot frame YouTube itself on iOS. That view does not scroll with the page, so the video
 * has a screen of its own with nothing to scroll past - the stage below the header is a placeholder
 * whose rect the player follows. On the web, where an http(s) origin can frame YouTube, the stage
 * holds the cookie-less embed instead.
 */
@Component({
  selector: 'app-content-video',
  host: { class: 'block' },
  imports: [FocusedScreenScaffold, LucideSquarePlay],
  templateUrl: './video.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentVideoPage {
  private readonly contentItems = inject(ContentItemsInteractor);
  private readonly player = inject(NativeVideoPlayer);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  readonly id = input.required<string>();
  /** Where leaving goes: the item the video belongs to, passed on by its cover. */
  readonly returnTo = input<string | null>(null);

  protected readonly safeReturnTo = computed(() => safeInAppUrl(this.returnTo()));
  protected readonly fallbackLink = computed(() => `/content/${this.id()}`);

  private readonly data = resource({
    params: () => this.id(),
    loader: ({ params: id }) => this.contentItems.findById(id),
  });

  protected readonly item = computed(() => valueOr(this.data, undefined) ?? null);
  protected readonly video = computed(() => this.item()?.video ?? null);
  protected readonly heading = computed(() => this.item()?.title ?? 'Video');
  protected readonly loaded = computed(() => this.data.status() === 'resolved');
  protected readonly portrait = computed(() => this.video()?.orientation === 'portrait');
  protected readonly watchUrl = computed(() => {
    const video = this.video();
    return video === null ? null : youtubeWatchUrl(video);
  });

  protected readonly native = this.player.available;
  protected readonly problem = signal<PlaybackProblem | null>(null);

  /** The web's player: the cookie-less embed, trusted here because it is built from a checked id. */
  protected readonly embedUrl = computed<SafeResourceUrl | null>(() => {
    const video = this.video();
    const url = video === null || this.native ? null : youtubeEmbedUrl(video);
    return url === null ? null : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  private handle: VideoPlayerHandle | null = null;
  /** The video the native player was opened for; the router reuses this screen for the next one. */
  private openedId: string | null = null;

  constructor() {
    effect(() => {
      const video = this.video();
      if (!this.native || video === null || video.id === this.openedId || !isYoutubeId(video.id)) {
        return;
      }
      this.closeNative();
      this.problem.set(null);
      this.openedId = video.id;
      // After the stage has rendered, so there is a rect to lay the player over.
      afterNextRender(() => void this.openNative(video.id), { injector: this.injector });
    });

    // The native view is not part of the page: it has to go before the next screen shows, not after.
    const navigation = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.closeNative();
        this.openedId = null;
      }
    });
    inject(DestroyRef).onDestroy(() => {
      navigation.unsubscribe();
      this.closeNative();
    });
  }

  private async openNative(videoId: string): Promise<void> {
    const stage = this.stage()?.nativeElement;
    if (stage === undefined || videoId !== this.openedId) {
      return;
    }
    if (this.document.defaultView?.navigator.onLine === false) {
      this.problem.set('offline');
      return;
    }

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

    // Left or moved on to another video while the player was being created.
    if (videoId !== this.openedId) {
      handle.close();
      return;
    }
    this.handle = handle;

    this.followStage(stage);
  }

  /**
   * Keeps the native view on its placeholder. The screen is built not to scroll, but the text size
   * can grow the header and push the stage down, and at the largest sizes the page can scroll after
   * all - so the frame follows every resize and every scroll, at most once per frame.
   */
  private followStage(stage: HTMLElement): void {
    const view = this.document.defaultView;
    if (view === null || this.handle === null) {
      return;
    }

    let scheduled = false;
    const sync = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      view.requestAnimationFrame(() => {
        scheduled = false;
        this.handle?.setFrame(stage.getBoundingClientRect());
      });
    };

    const resizes = new ResizeObserver(sync);
    resizes.observe(stage);
    resizes.observe(this.document.documentElement);
    // Capture, so a scroll in any container counts, not only the document's own.
    this.document.addEventListener('scroll', sync, { capture: true, passive: true });
    view.addEventListener('resize', sync);

    this.stopFollowing = () => {
      resizes.disconnect();
      this.document.removeEventListener('scroll', sync, { capture: true });
      view.removeEventListener('resize', sync);
    };
  }

  private stopFollowing: () => void = () => undefined;

  private closeNative(): void {
    this.stopFollowing();
    this.stopFollowing = () => undefined;
    this.handle?.close();
    this.handle = null;
  }
}
