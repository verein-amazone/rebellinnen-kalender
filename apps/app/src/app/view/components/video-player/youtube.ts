import type { VideoView } from '@app/interactors/daily-content/content-item.vm';

/** The only origin a video is framed from on the web: YouTube's cookie-less embed domain. */
const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

/** What a YouTube video id looks like - all an embed address is built from, besides the origin. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Plays inline (`playsinline`), starts at once since a tap asked for it (`autoplay`), suggests only
 * the same channel's videos at the end (`rel=0`), and shows German controls. Captions stay off
 * unless the viewer turns them on, in German first: several videos have subtitles burned in, and
 * YouTube's own would cover them.
 */
const EMBED_PARAMS = 'autoplay=1&playsinline=1&rel=0&hl=de&cc_lang_pref=de';

/** Whether `id` can be played at all - a malformed id only gets the link to YouTube. */
export function isYoutubeId(id: string): boolean {
  return YOUTUBE_ID.test(id);
}

/** The cookie-less embed address, or `null` for an id that is not a YouTube id. */
export function youtubeEmbedUrl(video: VideoView): string | null {
  return isYoutubeId(video.id) ? `${EMBED_ORIGIN}/embed/${video.id}?${EMBED_PARAMS}` : null;
}

/** The same video on YouTube itself: the Shorts player for an upright video. */
export function youtubeWatchUrl(video: VideoView): string {
  const id = encodeURIComponent(video.id);
  return video.orientation === 'portrait'
    ? `https://www.youtube.com/shorts/${id}`
    : `https://www.youtube.com/watch?v=${id}`;
}
