import { isYoutubeId, youtubeEmbedUrl, youtubeWatchUrl } from './youtube';

describe('youtube links', () => {
  const landscape = { provider: 'youtube', id: 'teTZq72DAlM', orientation: 'landscape' } as const;
  const portrait = { provider: 'youtube', id: '8mzUhlDdDUg', orientation: 'portrait' } as const;

  it('accepts only the shape of a YouTube id', () => {
    expect(isYoutubeId('teTZq72DAlM')).toBe(true);
    expect(isYoutubeId('_hx4Jl9UngQ')).toBe(true);
    expect(isYoutubeId('teTZq72DAl')).toBe(false);
    expect(isYoutubeId('../evil/xyz')).toBe(false);
  });

  it('embeds from the cookie-less domain only', () => {
    expect(youtubeEmbedUrl(landscape)).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\/teTZq72DAlM\?/,
    );
    expect(youtubeEmbedUrl({ ...landscape, id: 'x/../../y?z' })).toBeNull();
  });

  it('opens an upright video in the Shorts player and a wide one in the normal one', () => {
    expect(youtubeWatchUrl(landscape)).toBe('https://www.youtube.com/watch?v=teTZq72DAlM');
    expect(youtubeWatchUrl(portrait)).toBe('https://www.youtube.com/shorts/8mzUhlDdDUg');
  });
});
