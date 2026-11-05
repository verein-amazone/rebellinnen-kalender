import { find as findLinks } from 'linkifyjs';

/**
 * Online meetings in imported events. Calendars carry them in different places: Google Meet as a
 * generated block in the description, Teams as a block between underscore lines, Zoom and Webex
 * mostly as the location. The provider of a meeting is independent of the calendar's provider - a
 * Google calendar can hold a Teams meeting - so it is recognised from the join URL's host alone, never
 * from the surrounding text, which the provider may word differently or translate.
 *
 * Only description and location are read here; device calendars offer nothing else on both
 * platforms. Formats, sources and the open questions are recorded in
 * `docs/architecture/online-meetings.md`.
 */

export type MeetingProvider =
  'google-meet' | 'microsoft-teams' | 'zoom' | 'webex' | 'jitsi' | 'whereby' | 'goto' | 'facetime';

/** How the app names a provider, e.g. in „Google Meet beitreten“. */
export const MEETING_PROVIDER_NAMES: Readonly<Record<MeetingProvider, string>> = {
  'google-meet': 'Google Meet',
  'microsoft-teams': 'Microsoft Teams',
  zoom: 'Zoom',
  webex: 'Webex',
  jitsi: 'Jitsi Meet',
  whereby: 'Whereby',
  goto: 'GoTo Meeting',
  facetime: 'FaceTime',
};

export interface MeetingDialIn {
  /** The number as the invitation wrote it, e.g. `+43 1 2345678`. */
  readonly number: string;
  /** The PIN or meeting ID entered after the call connects, if the invitation names one. */
  readonly pin: string | null;
  /** Dials the number and then the PIN, so the caller does not type it. */
  readonly telUrl: string;
}

export interface OnlineMeeting {
  readonly provider: MeetingProvider;
  readonly joinUrl: string;
  readonly dialIn: MeetingDialIn | null;
}

export interface EventMeetingDetails {
  readonly meeting: OnlineMeeting | null;
  /** The description without the provider's generated block, or `null` if nothing else is left. */
  readonly description: string | null;
  /** The location, or `null` if it only repeated the meeting. */
  readonly location: string | null;
}

/** Join URLs by host and path, after MeetingBar's provider list. A provider's other pages do not match. */
const JOIN_URL_PATTERNS: readonly (readonly [MeetingProvider, RegExp])[] = [
  [
    'google-meet',
    /^https:\/\/meet\.google\.com\/(?:[a-z]{3}-[a-z]{4}-[a-z]{3}\b|lookup\/|_meet\/)/i,
  ],
  [
    'microsoft-teams',
    /^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|gov\.teams\.microsoft\.us)\/(?:l\/meetup-join\/|meet\/\d)/i,
  ],
  [
    'zoom',
    /^https:\/\/(?:[a-z0-9-]+\.)*(?:zoom(?:-x)?\.(?:us|com|de|com\.cn)|zoomgov\.com)\/(?:j|w|my)\//i,
  ],
  [
    'webex',
    /^https:\/\/(?:[a-z0-9-]+\.)?webex\.com\/(?:(?:[-a-z0-9]+\/)?j\.php\?MTID=|meet\/|join\/|m\/)/i,
  ],
  ['jitsi', /^https:\/\/meet\.jit\.si\/[^/?#\s]+/i],
  ['whereby', /^https:\/\/(?:[a-z0-9-]+\.)?whereby\.com\/[^/?#\s]+/i],
  [
    'goto',
    /^https:\/\/(?:global\.gotomeeting\.com\/join\/\d+|meet\.goto\.com\/[^/?#\s]+|gotomeet\.me\/[^/?#\s]+)/i,
  ],
  ['facetime', /^https:\/\/facetime\.apple\.com\/join/i],
];

/**
 * A provider's generated block in the description: two delimiter lines, or for Webex one line up to
 * the end. A block counts only if it contains a join URL of its own provider, so an ordinary line of
 * dashes or underscores is never cut.
 */
interface BlockRule {
  readonly provider: MeetingProvider;
  readonly delimiter: RegExp;
  readonly runsToEnd: boolean;
}

const BLOCK_RULES: readonly BlockRule[] = [
  // Google's 87-character `-::~:~::~:~:…::-` line, matched leniently as GNOME Calendar and deskleaf do.
  { provider: 'google-meet', delimiter: /^-:[:~]+::-$/, runsToEnd: false },
  // Outlook and Teams frame the invitation with lines of exactly 80 underscores.
  { provider: 'microsoft-teams', delimiter: /^_{80}$/, runsToEnd: false },
  // Zoom's browser extension frames its block with box-drawing lines.
  { provider: 'zoom', delimiter: /^─{10,}$/, runsToEnd: false },
  // Webex starts a `-~-~-~…` line and asks that nothing below it is changed.
  { provider: 'webex', delimiter: /^(?:-~){5,}-?$/, runsToEnd: true },
];

/** A Teams location that only names the meeting, in Outlook's English or German wording. */
const TEAMS_LOCATION = /^Microsoft Teams[- ](?:Meeting|Besprechung)$/i;

/** Finds the meeting of an event, and the description and location to show next to it. */
export function findOnlineMeeting(event: {
  readonly description: string | null;
  readonly location: string | null;
}): EventMeetingDetails {
  const block = event.description === null ? null : findBlock(event.description);
  const meeting =
    block?.meeting ??
    firstMeetingIn(event.location ?? '') ??
    firstMeetingIn(event.description ?? '');

  return {
    meeting,
    description: emptyAsNull(block === null ? event.description : block.remainder),
    location: repeatsMeeting(event.location, meeting) ? null : event.location,
  };
}

function findBlock(
  description: string,
): { readonly meeting: OnlineMeeting; readonly remainder: string } | null {
  const lines = description.split(/\r?\n/);
  for (const rule of BLOCK_RULES) {
    const delimiters = lines.flatMap((line, index) =>
      rule.delimiter.test(line.trim()) ? [index] : [],
    );
    if (delimiters.length === 0 || (!rule.runsToEnd && delimiters.length < 2)) {
      continue;
    }
    const start = delimiters[0];
    const end = rule.runsToEnd ? lines.length - 1 : delimiters[delimiters.length - 1];
    const blockText = lines.slice(start, end + 1).join('\n');
    const joinUrl = meetingUrls(blockText).find((found) => found.provider === rule.provider);
    if (joinUrl === undefined) {
      continue;
    }

    const remainder = [...lines.slice(0, start), ...lines.slice(end + 1)].join('\n');
    return {
      meeting: { ...joinUrl, dialIn: dialInIn(blockText, rule.provider) },
      remainder,
    };
  }
  return null;
}

function firstMeetingIn(text: string): OnlineMeeting | null {
  const found = meetingUrls(text)[0];
  return found === undefined ? null : { ...found, dialIn: null };
}

/** The join URLs in a text, in order: in running text, in `href`s and in `<https://…>` alike. */
function meetingUrls(
  text: string,
): readonly { readonly provider: MeetingProvider; readonly joinUrl: string }[] {
  return linkSources(text).flatMap((source) =>
    findLinks(source, 'url').flatMap((link) => {
      const url = unwrapRedirect(link.href);
      const match = JOIN_URL_PATTERNS.find(([, pattern]) => pattern.test(url));
      return match === undefined ? [] : [{ provider: match[0], joinUrl: url }];
    }),
  );
}

/**
 * The pieces of a text to search for links. Outlook writes plain-text links as `label <https://…>`,
 * which an HTML parser would take for a tag, so those become bare addresses first. HTML is then
 * parsed by the browser - never by regular expressions - and read in document order: each link's
 * `href`, and the text between. Entities are decoded on the way.
 */
function linkSources(text: string): readonly string[] {
  const plain = text.replace(/<(https?:\/\/[^\s<>]+)>/gi, ' $1 ');
  if (!/<[a-z]/i.test(plain)) {
    return [plain.replaceAll('&amp;', '&')];
  }

  const body = new DOMParser().parseFromString(plain, 'text/html').body;
  const sources: string[] = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof HTMLAnchorElement) {
      sources.push(node.getAttribute('href') ?? '');
    } else if (node instanceof Text && !node.parentElement?.closest('a')) {
      sources.push(node.data);
    }
  }
  return sources;
}

/**
 * Outlook's Safe Links and Google's `/url?q=` redirect wrap the real address in a parameter; the
 * provider is recognised from the address inside.
 */
function unwrapRedirect(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const wrapped = /(?:^|\.)safelinks\.protection\.outlook\.com$/i.test(url.hostname)
    ? url.searchParams.get('url')
    : /^(?:www\.)?google\.[a-z.]+$/i.test(url.hostname) && url.pathname === '/url'
      ? url.searchParams.get('q')
      : null;
  return wrapped !== null && /^https:\/\//i.test(wrapped) ? wrapped : href;
}

/**
 * The first dial-in of a block. Google writes `Or dial: (AT) +43 1 2345678 PIN: 123456789#`; Teams,
 * Zoom and Webex write one-tap strings such as `+4319284090,,98765432101#`. Either becomes a `tel:`
 * URI: `,` pauses, `;` waits for the caller to confirm (what Apple Calendar does for Meet), `#` is
 * percent-encoded.
 */
function dialInIn(blockText: string, provider: MeetingProvider): MeetingDialIn | null {
  if (provider === 'google-meet') {
    const match = /(\+\d[\d ()-]{4,}\d)\s+PIN:\s*(\d+)#?/.exec(blockText);
    if (match === null) {
      return null;
    }
    const [, number, pin] = match;
    return { number, pin, telUrl: `tel:${digitsOf(number)};${pin}%23` };
  }

  const oneTap = /(\+\d[\d -]{4,}\d),,([\d#*,]+)/.exec(blockText);
  if (oneTap === null) {
    return null;
  }
  const [, number, sequence] = oneTap;
  return {
    number,
    pin: null,
    telUrl: `tel:${digitsOf(number)},,${sequence.replaceAll('#', '%23')}`,
  };
}

function digitsOf(number: string): string {
  return `+${number.replace(/\D/g, '')}`;
}

function repeatsMeeting(location: string | null, meeting: OnlineMeeting | null): boolean {
  if (location === null || meeting === null) {
    return false;
  }
  const text = location.trim();
  return (
    text === meeting.joinUrl ||
    (meeting.provider === 'microsoft-teams' && TEAMS_LOCATION.test(text))
  );
}

function emptyAsNull(text: string | null): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
