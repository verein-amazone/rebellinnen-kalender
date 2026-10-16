import { linkPlatform } from './link-platform';

describe('linkPlatform', () => {
  it.each([
    ['https://www.instagram.com/astro_christina/?hl=de', 'instagram'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://m.youtube.com/watch?v=abc', 'youtube'],
    ['https://www.tiktok.com/@someone', 'tiktok'],
    ['https://open.spotify.com/playlist/abc', 'spotify'],
    ['https://at.linkedin.com/in/someone', 'linkedin'],
    ['https://www.snapchat.com/add/someone', 'snapchat'],
  ] as const)('recognises %s as %s', (url, platform) => {
    expect(linkPlatform(url)).toBe(platform);
  });

  it('treats any other site as the web', () => {
    expect(linkPlatform('https://www.nasa.gov/humans-in-space/astronauts/christina-koch/')).toBe(
      'web',
    );
  });

  it('does not take a look-alike domain for the platform', () => {
    expect(linkPlatform('https://notinstagram.com/someone')).toBe('web');
    expect(linkPlatform('https://instagram.com.example.org/someone')).toBe('web');
  });

  it('treats a malformed link as the web', () => {
    expect(linkPlatform('not a url')).toBe('web');
  });
});
