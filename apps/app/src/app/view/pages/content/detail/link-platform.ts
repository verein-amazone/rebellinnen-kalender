/**
 * The platform a "Mehr zum Thema" link points at, for the icon its row shows. `web` is everything
 * else, and keeps the plain external-link icon.
 */
export type LinkPlatform =
  'instagram' | 'youtube' | 'tiktok' | 'spotify' | 'linkedin' | 'snapchat' | 'web';

/** Each platform's domains. A link matches a domain itself and every subdomain of it. */
const PLATFORM_DOMAINS: readonly (readonly [Exclude<LinkPlatform, 'web'>, readonly string[]])[] = [
  ['instagram', ['instagram.com']],
  ['youtube', ['youtube.com', 'youtu.be']],
  ['tiktok', ['tiktok.com']],
  ['spotify', ['spotify.com']],
  ['linkedin', ['linkedin.com']],
  ['snapchat', ['snapchat.com']],
];

/**
 * Matches a link's host against the known platforms. Deliberately just the host: the icon is a
 * hint, and a link the matcher does not know still opens like any other.
 */
export function linkPlatform(url: string): LinkPlatform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'web';
  }

  for (const [platform, domains] of PLATFORM_DOMAINS) {
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return platform;
    }
  }
  return 'web';
}
