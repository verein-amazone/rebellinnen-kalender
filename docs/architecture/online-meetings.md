# Online meetings in imported events

How the app finds a video call in an event and what the formats look like. The code is
[`interactors/calendar/online-meeting.ts`](../../apps/app/src/app/interactors/calendar/online-meeting.ts);
the event detail shows the result as a „… beitreten“ button and, when the invitation has one, an
„Einwählen“ button. This page records what was found out in November 2026, so the next change does
not have to research it again.

## Where the data can come from

Events reach the app on two paths, and the device path often carries a third party's data after the
OS has synced it - a Google account added in iOS Settings, an Exchange account, Outlook's sync on
Android.

| Path                                   | What the app can read                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| ICS subscription (`ical.js`)           | Every property; kept: `SUMMARY`, `LOCATION`, `DESCRIPTION`, `URL` and the join link (below) |
| iOS device calendar (EventKit, plugin) | `notes` (description), `location`, `url`                                                    |
| Android device calendar (plugin)       | `description`, `location`; the plugin always returns `url: null` on Android                 |

`@ebarooni/capacitor-calendar` 8.10.0 exposes no iCal `X-*` properties, no Android
`ExtendedProperties` and no iOS `structuredLocation`. iOS offers reading apps no conference API
([`EKEvent`](https://developer.apple.com/documentation/eventkit/ekevent); `EKVirtualConferenceProvider`
is for conferencing apps that create rooms). Apple Calendar's own „Video Call Information“ is
undocumented and presumably detected from the text, as here. Android's `CalendarContract` has no
meeting column ([`EventsColumns`](https://developer.android.com/reference/android/provider/CalendarContract.EventsColumns)).
So on a device, description and location are what there is.

## Formats

- **Google Meet** puts a block into the description, framed by two identical 87-character lines
  `-::~:~::~:~:…::-` - the same string in every sample found, and hard-coded in
  [GNOME Calendar](https://gitlab.gnome.org/GNOME/gnome-calendar/-/blob/main/src/utils/gcal-utils.c).
  It holds the join link, `Or dial: (AT) +43 1 2345678 PIN: 123456789#`, a `tel.meet` page and a
  help link. The editor's HTML stays before it, unconverted, also on iOS via CalDAV. Every sample
  found was English, so detection relies on the delimiter and the `meet.google.com` link, never on
  the labels. ICS feeds additionally carry `X-GOOGLE-CONFERENCE`.
- **Microsoft Teams** frames the invitation with lines of exactly 80 underscores (often with an
  inner line of 32). The location says „Microsoft Teams Meeting“. Join links are
  `teams.microsoft.com/l/meetup-join/…` or, since January 2026, `teams.microsoft.com/meet/<id>?p=…`;
  `aka.ms/JoinTeamsMeeting`, `meetingOptions` and `dialin.teams.microsoft.com` are not join links.
  Outlook writes plain-text links as `label <https://…>`, which an HTML parser takes for a tag.
- **Zoom** puts the join link into the location. Zoom's browser extension frames its block with
  `──────────` lines; one-tap numbers look like `+4319284090,,98765432101#,,,,*123456#`.
- **Webex** puts the link into the location too, and starts its block with a `-~-~-~…` line that
  runs to the end of the description.
- Since August 2026 Google also writes Teams, Zoom and Webex links into the location of its own
  invitations ([Workspace Updates](https://workspaceupdates.googleblog.com/2026/08/improving-google-calendars-interoperability-with-third-party-video-conferencing-solutions.html)).
- RFC 7986 `CONFERENCE` is not emitted by Google, Microsoft or Zoom in any sample.

## How a meeting is found

1. An ICS feed's structured join link (`conferenceUrl`): `CONFERENCE` - the entry marked `VIDEO`,
   else the first `https` one - then `X-GOOGLE-CONFERENCE`, `X-MICROSOFT-SKYPETEAMSMEETINGURL`,
   `X-MICROSOFT-ONLINEMEETINGEXTERNALLINK` and `X-PM-CONFERENCE-URL`. `X-MICROSOFT-ONLINEMEETINGCONFLINK`
   is a SIP address and ignored. On an unknown host it is still a meeting („Online-Meeting
   beitreten“), because the feed says so. Kept for the series; an override does not change it.
2. A provider block in the description - delimiter pair (Webex: start line to the end) with a join
   link of that provider inside. It also yields the dial-in, and only such a block is removed from
   the shown description; an unpaired delimiter cuts nothing.
3. A join link in the event's `URL` (ICS) or `EKEvent.url` (iOS).
4. A join link in the location.
5. A join link anywhere in the description, in running text or in an `href`.

The provider comes from the join link's host and path alone (patterns adapted from
[MeetingBar](https://github.com/leits/MeetingBar/blob/master/MeetingBar/Meetings/MeetingProvider.swift)),
never from the calendar's provider: a Google calendar can hold a Teams meeting. Outlook Safe Links
and Google's `/url?q=` redirects are unwrapped first. An unknown link is never a meeting. A location
that only repeats the join link, or only says „Microsoft Teams Meeting“, is not shown again.
An event `URL` that is not the join link is offered as „<host> öffnen“ - the host, because where a
tap leads matters - unless the description already shows it.

The dial-in becomes a `tel:` URI: `,` pauses, `;` waits for the caller to confirm (Apple Calendar
does that for Meet: number, `;`, PIN), `#` is written `%23`. Join links stay plain `https` links;
the WebView hands them to the OS, which opens the provider's app through Universal Links / App Links
when it is installed.

## Not yet covered

- Feeds stored before migration 23 get the new fields at their next full download: the migration
  drops their `ETag`/`Last-Modified`, so the next regular refresh cannot answer `304`.
- To verify on devices:
  - Android with a Google account: does a Meet event's `description` contain the block at all?
  - iOS with a Google account: are `url` or `location` set?
  - Teams invitations through Exchange on iOS and Outlook's sync on Android: plain text or HTML?
  - A Google organizer with a non-English account: is the block translated?
  - `tel:` with `;` and `%23` on current iOS and Android.
  - Teams links on Android 12+: Teams publishes no `assetlinks.json`, so they may open the browser
    first.
